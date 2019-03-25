'use strict'
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid')
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI,{ useNewUrlParser: true,useCreateIndex: true })

const Schema=mongoose.Schema

const userSchema=Schema({
  _id: {
  'type': String,
  'default': shortid.generate
  },
  username:{
  'type': String,
  'unique': true
  }
})

const exerciseSchema=Schema({
  _id: {
    'type': String,
    'default': shortid.generate
  },
  user_id:{
    'type': String,
    'ref': 'User',
    required:true
  },
  description:{
    'type':String,
    required:true
  },
  date:{
    'type':Date,
    default: Date.now
  },
  duration:{
    'type':Number,
    required:true
  }
})

const User=mongoose.model('User',userSchema)
const Exercise=mongoose.model('Exercise',exerciseSchema)



app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

app.post('/api/exercise/new-user',function(req,res,next){
  if(!req.body){return next(new Error("Request failed."));}
  else{
    if(!req.body.username){return next(new Error("Request read failed."));}
    else{
    User.create({username:req.body.username},function(err,data){
      if(err){return next(new Error("User creation failed."));}
      else{res.json({"username":data.username,"_id":data._id});next();}
    });
  }}
});

app.get('/api/exercise/users',function(req,res,next){
  User.find({},function(err,data){
    if(err){return next(new Error("List users failed."));}
    else{
      if(!data){return next(new Error("No users found."));}
      else{
        res.json(data.map(user=>({"username":user.username,"_id":user._id})));
        next();
      }
    }
  });
});

app.get('/api/exercise/log',function(req,res,next){
  if(!req.query.userId){return next(new Error('Param "userId" required.'));}
  else{
    let toDate;
    let fromDate;
    let limit;
    if(req.query.to){
      toDate=new Date(req.query.to);
      if(!toDate){return next(new Error('Param "to" error.'));}      
    }
    if(req.query.from){
      fromDate=new Date(req.query.from);
      if(!fromDate){return next(new Error('Param "from" error.'));}
    }
    if(req.query.limit){
      limit=parseInt(req.query.limit);
      if(!limit){return next(new Error('Param "limit" error'));}
    }
    User.findOne({_id:req.query.userId},function(err,userdata){
      if(err){return next(new Error("User not found."));}
      else{
        let query={};
        let addDate=false;
        if(fromDate){
          query.$gte=fromDate;
          addDate=true;
        }
        if(toDate){
          query.$lt=toDate;
          addDate=true;
        }
        let dbquery;
        console.log(query);
        if(addDate){dbquery=Exercise.find({user_id:userdata._id,date:query});}
        else{dbquery=Exercise.find({user_id:userdata._id});}
        if(limit){
          dbquery=dbquery.limit(limit);
        }
        dbquery.exec(function(er,data){
          if(er){console.log(er);return next(new Error("Log error."))}
          else{
            let retval={_id:userdata._id,username:userdata.username};
            if(fromDate){retval.from=fromDate.toDateString();}
            if(toDate){retval.to=toDate.toDateString();}
            //if(limit){retval.limit=limit;}
            if(data){
              retval.count=data.length;
              retval.log=data.map(x=>({description:x.description,duration:x.duration,date:x.date.toDateString()}));
            }else{
              retval.count=0;
              retval.log=[];
            }
            res.json(retval);
            next();
          }
        });
      }
    });
  }
});
app.post('/api/exercise/add',function(req,res,next){
  if(!req.body){return next(new Error("Request failed."));}
  else{
    if(!(req.body.userId&&req.body.description&&req.body.duration)){return next(new Error("Request read failed."));}
    else{
      let odate=null;
      let oduration=null;
      if(req.body.date){
        let re1=/^([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/
        if(!re1.test(req.body.date)){return next(new Error('Date read failed. Date must be in "yyyy-mm-dd" format.'));}
        else{odate=new Date(req.body.date);}
      }
      let re2=/^(\+)?[0-9]+$/
      if(!re2.test(req.body.duration)){return next(new Error('Duration read failed. Duration must be positive integer.'));}
      else{oduration=req.body.duration;}
      User.findOne({_id:req.body.userId},function(err,data){
        if(err){return next(new Error("User search error."));}
        else{
          if(!data){return next(new Error("User not found."));}
          else{
            let ex={user_id:req.body.userId,
                    description:req.body.description,
                    duration:req.body.duration};
            if(odate){ex.date=odate;}
            Exercise.create(ex,function(err,dat){
              if(err){return next(new Error("Exercise creation failed."));}
              else{res.json({"username":data.username,"description":dat.description,"duration":dat.duration,"_id":data._id,"date":dat.date.toDateString()});next();}
            });
          }
        }
      });
    }    
  }
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage
  console.log(err);
  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
