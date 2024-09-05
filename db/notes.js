const mongoose = require('mongoose');

const notesdetailsSchema = new mongoose.Schema({
  pdf:String,
  title:String,
},{collection:"notesdetails"})

mongoose.model('notesdetails', notesdetailsSchema);