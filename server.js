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

// count total edge
app.get('/countEdge/:graphName', (req, res) => {
	var graphName = req.params.graphName;
	console.log("graph to count edge: " + graphName);

	var edgeCounter = 0;
	db.collection('vertices').find({graph_name: graphName}).forEach(
		function iterCallback(vertex) {
			if (vertex.edges && vertex.edges.length) {
				edgeCounter += vertex.edges.length;
				console.log("edges " + edgeCounter);
			}
		},
		function endCallback(err) {
			if (err) {
				console.log(err);
			} else {
				res.send(edgeCounter.toString());
			}
		}
	);
})

// count total vertex
app.get('/countVertex/:graphName', (req, res) => {
	verticesDrawn = {};

	var graphName = req.params.graphName;
	console.log("graph to count vertex: " + graphName);
	db.collection('vertices').countDocuments({graph_name: graphName}, (err, count) => {
		if (err) {
			console.log(err);
		}
		console.log("count " + count + " vertices");

		res.send((count).toString());
	});
})

// query vertices of given graph
app.get('/queryGraphVertex/:graphName/:batchSize/:iteration', (req, res) => {
	verticesToRespond = {};

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
		  .forEach(function iterCallback(vertex) {
		  	// first pass: parse all vertices here
		  	parseVertex(vertex);
		  },
		  function endCallback(err) {
		  	if (err) {
		  		console.log(err);
		  	} else {
		  		// second pass: check if there is any vertex not drawn
		  		console.log("first pass DONE all vertices parsed in back-end\n"
		  					+ "verticesToRespond size " + Object.keys(verticesToRespond).length
		  					+ "\nverticesDrawn size " + Object.keys(verticesDrawn).length);

		  		res.send(verticesToRespond);
		  	}
		  });


  	// deprecate this response when 3-pass back-end processing is implemented
	// cursor = db.collection('vertices').find({graph_name: graphName});
	// cursor.skip(iteration * batchSize)
	// 	  .limit(parseInt(batchSize, 10))
	// 	  .stream()
	// 	  .pipe(JSONStream.stringify())
	// 	  .pipe(res);
});

// TODO implement query edges API

/*
	the response object
	{
		vid: {
			ori: [w, x, y, z],
			pos: [x, y, z],
			edges: [vid...]
		}
		.
		.
		.
	}

*/
var verticesToRespond; // record response for each batch query, reset in queryGraphVertex
var verticesDrawn; // record all vertice in this graph, reset in countVertex

/*
1, first pass, parse each vertex that belongs to this batch, compose key-val pair in its full format(i.e. w/ edges)
	in the verticesDrawn map, also put in verticesToRespond map
*/

// parse each vertex, in particular, extract its ori, pos, and edges
function parseVertex(vertex) {
	var edges;
	var poses;
	var extractFull = {"ori": undefined,
					   "pos": undefined,
					   "edges": []};
	var vid = vertex.vid;
	// console.log("parsing " + vid);

	// iterate on all field in this vertex
	for (var item in vertex) {
		if (item === "edges") {
			edges = vertex[item];
		} else if (item === "poses") {
			poses = vertex[item];
		}
	}

	if (poses) {
		parsePoses(poses, extractFull);
	}

	if (edges) {
		parseEdges(edges, extractFull);
	}
	
	verticesToRespond[vid] = extractFull;
	verticesDrawn[vid] = extractFull;
	// console.log("vid " + vid
	// 			+ "\nextractFull: " + JSON.stringify(verticesToRespond[vid]));
}

// extract ori, pos
function parsePoses(poses, extractFull) {
	var firstPose, ori, pos;

	for (var pose in poses) {
		firstPose = pose;
		ori = poses[pose].ori;
		pos = poses[pose].pos;
		if (ori && pos) {
			extractFull["ori"] = ori;
			extractFull["pos"] = pos;
			break;
		}
	}
}

// extract "to" from edges array
function parseEdges(edges, extractFull) {
	for (var i = 0; i < edges.length; ++i) {
		extractFull["edges"].push(JSON.stringify(edges[i]["to"]));
	}
}