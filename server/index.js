require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const stripe = require('stripe')(process.env.VITE_STRIPE_SECRETKEY)
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



//send email using nodemailer
const sendEmail = async (emailAddress, emailData) => {
  //create transporter
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.NodeMailer_user,
      pass: process.env.NodeMailer_pass,
    },
  });
  // transporter.verify((error,success)=>{
  //   if(error){
  //     console.log(error)
  //   }
  //   else{
  //     console.log('Transporter is ready to emails.', success)
  //   }
  //  })

  // const mailBody = {
  //   from: process.env.NODEMAILER_USER, // sender address
  //   to: emailAddress, // list of receivers
  //   subject: emailData?.subject, // Subject line
  //   html: `<p>${emailData?.message}</p>`, // html body
  // }

  // // send email
  // transporter.sendMail(mailBody, (error, info) => {
  //   if (error) {
  //     console.log(error)
  //   } else {
  //     // console.log(info)
  //     console.log('Email Sent: ' + info?.response)
  //   }
  // })
  await transporter.verify();
  console.log("Server is ready to take our messages");

  (async () => {
    try {
      const info = await transporter.sendMail({
        from: process.env.NODEMAILER_USER, // sender address
        to: emailAddress, // list of receivers
        subject: emailData?.subject, // Subject line
        html: `<p>${emailData?.message}</p>`, // html body
      });

      console.log("Message sent: %s", info.messageId);
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    } catch (err) {
      console.error("Error while sending mail", err);
    }
  })();
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

      const emailAddress = req.params.email;
      const emailData = {
        subject: "Welcome to our platform",
        message: `Hello ${
          req.body.name || "user"
        }, your account has been created.`,
      };

      await sendEmail(emailAddress, emailData);

      const result = await usersCollection.insertOne({
        ...user,
        role: "customer",
        timestamp: Date.now(),
      });

      res.send(result);
    });

    //get user role
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    // Admin Routes/////////////////////////////////////////////////////////////////////
    //
    //
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

    app.get('/admin-stat',verifyToken, verifyAdmin, async(req,res)=>{
      //get total orders,total plants
      const totalUser = await usersCollection.estimatedDocumentCount()
      const totalPlants = await plantsCollection.countDocuments()

      const allOrder = await ordersCollection.find().toArray()
      const totalOrders = allOrder.length;
      const totalPrice = allOrder.reduce((sum,order) =>sum+(order.price || 0),0)

      //get total revenue,total order
      const orderDetails = await ordersCollection.aggregate([
        {$group:{
          _id:null,  //not grouped by a specific field
          totalRevenue:{$sum:"$price"},
          totalOrder: {$sum:1}
        },
      },
      {
        $project:{
          _id:0,
        },
      }
      ]).next()


      res.send({totalPlants,totalUser,totalOrders,totalPrice,...orderDetails})

    })

    // seller Routes ///////////////////////////////////////////////////////////////
    //
    //
    //
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
        const order = await ordersCollection.findOne(query);
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

    //Manage plant quantify used for both seller and customer role
    app.patch("/plants/quantify/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { quantityToUpdate, status } = req.body;
      const filter = { _id: new ObjectId(id) };
      let updatedDoc = {
        $inc: { quantity: -quantityToUpdate },
      };
      if (status === "increase") {
        updatedDoc = {
          $inc: { quantity: quantityToUpdate },
        };
      }
      const result = await plantsCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });
    
    //  // // // /// // // // / //////////////////////////////////////////////////////////////////////////////
    //Customer Routes
    //
    //
    //
    // 
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

    // delete orders customer route
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




     // create payment intent
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const { quantity, plantId } = req.body
      const plant = await plantsCollection.findOne({
        _id: new ObjectId(plantId),
      })
      if (!plant) {
        return res.status(400).send({ message: 'Plant Not Found' })
      }
      const totalPrice = quantity * plant.price * 100 // total price in cent (poysha)
      const { client_secret } = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      })
      res.send({ clientSecret: client_secret })
    })


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
