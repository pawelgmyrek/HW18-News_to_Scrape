var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");
var axios = require("axios");
var cheerio = require("cheerio");
var exphbs = require("express-handlebars");

var db = require("./models");

var PORT = process.env.PORT || 3000;

var app = express();

app.use(logger("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

mongoose.connect(MONGODB_URI);

app.get("/", function(req, res){
	db.Article.find(function(error, data){
		var hbsObject = {
			article: data
		};
		console.log(hbsObject);
		res.render("index", hbsObject);
	});
});

app.get("/scrape", function(req, res) {
  axios.get("http://www.nytimes.com/").then(function(response) {
    var $ = cheerio.load(response.data);
		$("article").each(function(i,element) {
			var result = {};
			result.title = $(this).children("h2").text();
			result.summary = $(this).children(".summary").text();
			result.link = $(this).children("h2").children("a").attr("href");

      db.Article.create(result)
      .then(function(dbArticle) {
        console.log(dbArticle);
      })
      .catch(function(err) {
        console.log(err);
      });
    });
    res.send("Scrape Complete");
	});
});

app.get("/articles", function(req, res) {
  db.Article.find({})
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});

app.get("/articles/:id", function(req, res) {
  db.Article.findOne({ _id: req.params.id })
    .populate("note")
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});

app.post("/articles/:id", function(req, res) {
  db.Note.create(req.body)
    .then(function(dbNote) {
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});

app.post("/articles/delete/:id", function(req,res){
	db.Article.findOneAndUpdate({ "_id": req.params.id}, {"saved": false, "notes":[]})
	.then(function(err, doc){
		if(err){
			console.log(err);
		}
		else{
			res.send(doc);
		}
	});
});

app.post("notes/save/:id", function(req,res){
	var newNote = new Note({
		title: req.title.text,
		body: req.params.id
	});

	newNote.save(function(error, note){
    if(error){
			console.log(error);
		}
		else{
			Article.findOneAndUpdate({ "_id": req.params.id}, {$push: { "notes": note } })
			.then(function(err){
				if(err){
					console.log(err);
					res.send(err);
				}
				else{
					res.send(note);
				}
			});
		}
	});
});

app.delete("/notes/delete/:note_id/:article_id/", function(req,res){
	db.Note.findOneAndRemove({"_id": req.params.note.id}, function(err){
		if(err){
			console.log(err);
			res.send(err);
		}
		else{
			db.Article.findOneAndUpdate({"_id": req.params.article_id}, {$pull: {"notes": req.params.note_id}})
			.then(function(err){
        if(err){
					console.log(err);
					res.send(err);
				}
				else{
					res.send("Note Deleted");
				}
			});
		}
	});
});


app.listen(PORT, function() {
  console.log("App running on port " + PORT);
});
