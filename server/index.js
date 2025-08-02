require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");

const port = process.env.PORT || 9000;
const app = express();
// middleware

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uo8ft.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db("TreeVive");
    const usersCollection = db.collection("users");
    const plantsCollection = db.collection("plants");
    const ordersCollection = db.collection("orders");

    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== "admin") {
        return res
          .status(403)
          .send("unauthorized access,Admins Only Approved!");
      }
      next();
    };

    const verifySeller = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== "seller") {
        return res
          .status(403)
          .send("unauthorized access,Admins Only Approved!");
      }
      next();
    };

    // Generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
      if (!email?.email)
        return res.status(400).send({ error: "Email required" });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    //get user role
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send({ role: result?.role });
    });
    // save or update a user in db
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = req.body;
      // check if user exists in db
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const result = await usersCollection.insertOne({
        ...user,
        role: "customer",
        timestamp: Date.now(),
      });
      res.send(result);
    });
    // request to become a  seller
    app.patch("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (!user || user?.status === "Requested") {
        return res
          .status(400)
          .send("You have already Requested, wait for some time");
      }
      const updatedDoc = {
        $set: {
          status: "Requested",
        },
      };
      const result = await usersCollection.updateOne(user, updatedDoc);
      res.send(result);
    });

    //  manage-users
    app.get(
      "/manage-users/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: { $ne: email } };
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      }
    );

    // update user role & status
    app.patch(
      "/user/role/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const { role } = req.body;
        const filter = { email };
        const updateDoc = {
          $set: { role, status: "Verified" },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    app.post("/plants", verifyToken, verifySeller, async (req, res) => {
      const plant = req.body;
      const result = await plantsCollection.insertOne(plant);
      res.send(result);
    });

    app.get("/plants", async (req, res) => {
      const result = await plantsCollection.find().limit(12).toArray();
      res.send(result);
    });
    // get a plant by id
    app.get("/plants/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await plantsCollection.findOne(query);
      res.send(result);
    });

    // get seller plant inventory
    // app.get("plants/seller", verifyToken, async (req, res) => {
    //   const email = req.user?.email;
    //   const result = await plantsCollection
    //     .find({ 'seller.email': email })
    //     .toArray();
    //   res.send(result);
    // });

    app.get("/pplants/seller", verifyToken, verifySeller, async (req, res) => {
      const email = req.user.email;
      const result = await plantsCollection
        .find({ "seller.email": email })
        .toArray();
      res.send(result);
    });

    //  delete plant from seller inventory
    app.delete(
      "/inventory/:id",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await plantsCollection.deleteOne(query);
        res.send(result);
      }
    );

    //manage orders for seller
    app.get(
      "/manageOrders/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        try {
          const email = req.params.email;
          const result = await ordersCollection
            .aggregate([
              {
                $match: { seller: email },
              },
              {
                $addFields: {
                  plantId: { $toObjectId: "$plantId" },
                },
              },
              {
                $lookup: {
                  from: "plants", //// local data that you want to match
                  localField: "plantId",
                  foreignField: "_id",
                  as: "plants",
                },
              },

              { $unwind: "$plants" }, // unwind lookup result, return without array
              {
                $addFields: {
                  // add these fields in order object
                  name: "$plants.name",
                  // image: "$plants.image",
                  // category: "$plants.category",
                },
              },
              {
                // remove plants object property from order object
                $project: {
                  plants: 0,
                },
              },
            ])
            .toArray();

          // if (result.length === 0) {
          //   return res.status(404).json({ message: "No orders found" });
          // }

          res.send(result);
        } catch (error) {
          console.error("Error in /customer-orders/:email route", error);
          res.status(500).json({ message: "Server error", error });
        }
      }
    );

    // update or change order status by seller
    app.patch("/orders/:id", verifyToken, verifySeller, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { status },
      };
      const result = await ordersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // cancel or delete orders from seller inventory
    app.delete(
      "/sellerOrder/:id",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const order = await ordersCollection.deleteOne(query);
        if (order.status === "Delivered")
          return res
            .status(409)
            .send("cannot send once the product is deliverd");
        const result = await ordersCollection.deleteOne(query);
        res.send(result);
      }
    );

    //save order data in db
    app.post("/order", verifyToken, async (req, res) => {
      const orderInfo = req.body;
      console.log(orderInfo);
      const result = await ordersCollection.insertOne(orderInfo);
      res.send(result);
    });

    //Manage plant quantify
    app.patch("/plants/quantify/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { quantifyToUpdate, status } = req.body;
      const filter = { _id: new ObjectId(id) };
      let updatedDoc = {
        $inc: { quantity: -quantifyToUpdate },
      };
      if (status === "increase") {
        updatedDoc = {
          $inc: { quantity: quantifyToUpdate },
        };
      }
      const result = await plantsCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    //get all orders from a specific customer
    app.get("/customer-orders/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const result = await ordersCollection
          .aggregate([
            {
              $match: { "customer.email": email },
            },
            {
              $addFields: {
                plantId: { $toObjectId: "$plantId" },
              },
            },
            {
              $lookup: {
                from: "plants", //// local data that you want to match
                localField: "plantId",
                foreignField: "_id",
                as: "plants",
              },
            },

            { $unwind: "$plants" }, // unwind lookup result, return without array
            {
              $addFields: {
                // add these fields in order object
                name: "$plants.name",
                image: "$plants.image",
                category: "$plants.category",
              },
            },
            {
              // remove plants object property from order object
              $project: {
                plants: 0,
              },
            },
          ])
          .toArray();

        if (result.length === 0) {
          return res.status(404).json({ message: "No orders found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error in /customer-orders/:email route", error);
        res.status(500).json({ message: "Server error", error });
      }
    });

    // delete orders
    app.delete("/orders/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const order = await ordersCollection.findOne(query);
      if (order.status === "Delivered")
        return res
          .status(409)
          .send("cannot cancel once the product is delivered!");

      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from plantNet Server..");
});

app.listen(port, () => {
  console.log(`plantNet is running on port ${port}`);
});
