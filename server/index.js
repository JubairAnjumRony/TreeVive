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

    // save or update a user in db
    // app.post('/users/:email',async(req,res) =>{
    //   const email =req.params.email
    //   const query = {email}
    //   const  user = req.body
    //   console.log({user});
    //   //check if  user exist in db
    //   const isExist = await userCollection.findOne(query)
    //   if(isExist){
    //     return res.send(isExist)
    //   }
    //   const result  = await userCollection.insertOne({
    //     ...user,
    //     role:'customer',
    //     timestamp: Date.now(),})
    //   res.send(result);
    // })
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

    app.post('/plants', verifyToken, async (req,res) =>{
      const plant = req.body;
      const result =await plantsCollection.insertOne(plant);
      res.send(result);
    })

    app.get ('/plants', async (req,res) =>{
     const result = await plantsCollection.find().limit(12).toArray()
     res.send(result)
    })
    // get a plant by id
    app.get("/plants/:id",async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
        const result = await plantsCollection.findOne(query);
        res.send(result);
      }
    )

    //save order data in db
    app.post('/order',verifyToken,async(req,res)=>{
      const orderInfo = req.body
      console.log(orderInfo)
      const result = await ordersCollection.insertOne(orderInfo)
      res.send(result)
    })

    //Manage plant quantify
    app.patch('/plants/quantify/:id',verifyToken,async(req,res)=>{
      const id = req.params.id
      const {quantifyToUpdate,status} = req.body
      const filter = {_id: new ObjectId(id)}
      let updatedDoc ={
        $inc:{quantity: -quantifyToUpdate},
      }
      if(status==='increase'){
        updatedDoc = {
         $inc: {qunatity: quantifyToUpdate},
        }
      }
      const result = await plantsCollection.updateOne(filter,updatedDoc)

      res.send(result);
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
