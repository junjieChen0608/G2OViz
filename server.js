console.log('server running');

const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const app = express();
const JSONStream = require('JSONStream');

app.use(express.static('public'));
app.use(express.static(__dirname + '/build'));

let db;
const url = 'mongodb://localhost:27017/';

MongoClient.connect(url,
					{useNewUrlParser: true}, (err, database) => {
	if (err) {
		return console.log(err);
	}

	db = database.db('hdmap');

	app.listen(8080, () => {
		console.log('listening on 8080');
	});
});

// homepage
app.get('/', (req, res) => {
	console.log("dirname: " + __dirname);
	res.sendFile(__dirname + '/index.html');
});

// query graph name
app.get('/queryGraph/:graphName', (req, res) => {
	var graphName = req.params.graphName;
	console.log("graph name to query: " + graphName);

	res.set('Content-Type', 'application/json');
	var cursor = db.collection('vertices').find({graph_name: graphName});
	
	cursor.count((err, count) => {
		if (err) {
			console.log(err);
		}

		if (count > 0) {
			cursor.stream().pipe(JSONStream.stringify())
		  		   		   .pipe(res);
		} else {
			res.sendStatus(404);
		}
	});
		
});