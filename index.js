const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient ,ObjectId } = require('mongodb');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');


const app = express();
const PORT = 5002;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// MongoDB connection URI
const uri = 'mongodb+srv://amansingh220899:ojtDi3ItT3bALwEt@cluster0.m7jpu.mongodb.net/'; // Update with your MongoDB URI
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });



// Function to connect to MongoDB
async function connectToMongoDB(collectionName) {
  try {
    // Connect to the MongoDB client
    await client.connect();
    // Set the database and collection
    const dbName = 'noteswallah'; // Update with your database name
    const db = client.db(dbName);
    const collection = db.collection(collectionName);


    // Return the collection object
    return collection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/uploads/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, 'uploads', fileName);
  if(path.exits(filePath)) {
    res.type("application/pdf");
    res.header('Content-Disposition', 'inline');
    res.sendFile(filePath);
  } else {
    res.status(404).send('not found')
  }

  // fs.exists(filePath, (exists) => {
  //   if (exists) {
      
  //     res.setHeader('Content-Type', 'application/pdf');
  //     res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  //     fs.createReadStream(filePath).pipe(res);
  //   } else {
  //     res.status(404).send(`File not found: ${fileName}`);
  //   }
  // });
});

// Route to handle user registration
app.post('/register', async (req, res) => {
  const { name, userName, phoneNumber, email, password } = req.body;

  // Check if any required fields are missing
  if (!name || !userName || !phoneNumber || !email || !password) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }

  // Connect to MongoDB
  const collectionName = 'users';
  const collection = await connectToMongoDB(collectionName);

  try {
    // Check if the username or email is already taken
    const existingUser = await collection.findOne({ $or: [ { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    // Insert the new user into the database
    const newUser = { name, userName, phoneNumber, email, password };
    const userData = await collection.insertOne(newUser);
    const user = await collection.findOne({_id: userData.insertedId});
    // Respond with success message
    res.status(201).json({ message: 'User registered successfully.',  data: user});
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Connect to MongoDB
    const collectionName = 'users';
    const collection = await connectToMongoDB(collectionName);

    // Find the user by email
    const user = await collection.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Compare passwords (assuming you have stored hashed passwords)
    const passwordMatch = user.password === password;

    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Respond with success message
    res.status(200).json({ success: true, message: 'Login successful.', user: user });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

const storage = multer.memoryStorage(); // Using memory storage for buffers
const upload = multer({ storage: storage });


const connectionString = 'DefaultEndpointsProtocol=https;AccountName=storenoteswalah;AccountKey=iysMTXRzAFBaMOfDAfNGWNlnmOmtHS7t5k+bOO8aC+BJuiB9kBJ+59fpveAWEBIEYxoDgcxdobWm+AStYxm9ug==;EndpointSuffix=core.windows.net'

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient('rawzone');

function generateSasUrl(blobClient) {
  const saasOptoins  = {
    containerName: 'rawzone',
    blobName: blobClient.name,
    permissions: BlobSASPermissions.parse('r'),
    startOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 86400),
  }
  const saasToken = generateBlobSASQueryParameters(saasOptoins, blobServiceClient.credential).toString()
  return `${blobClient.url}?${saasToken}`;
}

app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: 'No file uploaded' });
  }

  const file = req.file;
  const filename = req.file.originalname;
  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  try {
    await blockBlobClient.upload(req.file.buffer, req.file.size);
    const url = generateSasUrl(blockBlobClient);
    console.log(url);
     // Connect to MongoDB
  const collectionName = 'notesdetails';
  const collection = await connectToMongoDB(collectionName);

    // Insert the new note into the database
    const newNote = {
      name: filename,
      category: req.body.category,
      title: req.body.title,
      url: url,
      ownerEmail: req.body.email,
    };

    await collection.insertOne(newNote);

    // Respond with success message
    res.status(201).json({ message: 'PDF uploaded successfully.' });

  } catch(e) {
    console.log('e', e)
    res.status(400).send('someting went wrong')
  }
});


// Configure multer to save files to uploads folder
// const uploadFolder = 'uploads';
// const storage = multer.memoryStorage(); // Using memory storage for buffers
// const upload = multer({ dest: uploadFolder, storage: storage });

// // Route to handle PDF uploads
// app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
//   console.log('res', req.body)
//   const file = req.file;
//   const filename = file.originalname;
//   const filePath = path.join(uploadFolder, filename);
//   fs.writeFileSync(filePath, file.buffer);

//   // Connect to MongoDB
//   const collectionName = 'notesdetails';
//   const collection = await connectToMongoDB(collectionName);

//   try {
//     // Insert the new note into the database
//     const newNote = {
//       name: filename,
//       category: req.body.category,
//       title: req.body.title,
//       url: `/uploads/${filename}`,
//       ownerEmail: req.body.email,
//     };

//     await collection.insertOne(newNote);

//     // Respond with success message
//     res.status(201).json({ message: 'PDF uploaded successfully.' });
//   } catch (error) {
//     console.error('Error uploading PDF:', error);
//     res.status(500).json({ error: 'Internal server error.' });
//   }
// });

app.get('/notes', async (req, res) => {
  const collectionName = 'notesdetails';
  const collection =await connectToMongoDB(collectionName);
  // Get all notes from the database
  const notes = await collection.find({ownerEmail: req.query.email}).toArray();
  // Send the notes as a response
  res.status(200).send({message: 'Message', data: notes || []})
})
app.get('/userprofile', async (req, res) => {
  const collectionName = 'users';
  const collection = await connectToMongoDB(collectionName);
  // Get all notes from the database  
  const user = await collection.find({email: req.query.email}).toArray();
  // Send the notes as a response
  res.status(200).send({message: 'Message', data: notes || []})
})
app.get('/all-notes', async (req, res) => {
  const collectionName = 'notesdetails';
  const collection = await connectToMongoDB(collectionName);
  const notes  = await collection.find({}).toArray();
  const filterList = notes.filter(note => note.email !== req.query.email);

  res.status(200).send({message: 'All notes', data: filterList})
})


//delete api 
app.delete('/notes/:id', async (req, res) => {
  const id = req.params.id;

  try {
    // Connect to MongoDB
    const collectionName = 'notesdetails';
    const collection = await connectToMongoDB(collectionName);

    // Delete the note from the database
    const isExisRecord= await collection.findOne({_id: new ObjectId(id)})
    
    if(isExisRecord) {
      const result = await collection.deleteOne({ _id: new ObjectId(id) });

      res.status(200).json({ message: 'Note deleted successfully.' });

    } else {
      // Respond with error message
      res.status(404).json({ error: 'Note not found.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Route to check if the server is running
app.get('/', (req, res) => {
  res.status(200).send(`App is running on port ${PORT}`);
});

app.get('/', (req, res) => {
  res.status(200).send('App is running on port'+ PORT,)
})
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});