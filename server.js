console.log('server running');

const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const app = express();

app.use(express.static('public'));

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
app.post('/queryGraph/:graphName', (req, res) => {
	var graphName = req.params.graphName;
	console.log("graph name to query: " + graphName);
	db.collection('graphs').findOne({name: graphName},(err, result) => {
		if (err) {
			return console.log(err);
		}

		console.log("callback " + result);
		if (result !== null) {
			res.send(result);
		} else {
			res.sendStatus(404);
		}
	});
});