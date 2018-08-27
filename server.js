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

// count total vertex
app.get('/countVertex/:graphName', (req, res) => {
	var graphName = req.params.graphName;
	console.log("graph to count: " + graphName);
	db.collection('vertices').countDocuments({graph_name: graphName}, (err, count) => {
		if (err) {
			console.log(err);
		}
		console.log("count " + count + " vertices");

		res.send((count).toString());
	});
})

// query graph
app.get('/queryGraph/:graphName/:batchSize/:iteration', (req, res) => {
	var graphName = req.params.graphName;
	var batchSize = req.params.batchSize;
	var iteration = req.params.iteration;
	console.log("graph to query: " + graphName
				+ "\nbatch size: " + batchSize
				+ "\niteration: " + iteration);

	res.set('Content-Type', 'application/json');
	var cursor = db.collection('vertices').find({graph_name: graphName});
	cursor.skip(iteration * batchSize)
		  .limit(parseInt(batchSize, 10))
		  .stream()
		  .pipe(JSONStream.stringify())
		  .pipe(res);
});