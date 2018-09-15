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

	// simplify the count logic, just send status 200
    res.sendStatus(200);

	// var edgeCounter = 0;
	// db.collection('vertices').find({graph_name: graphName}).forEach(
	// 	function iterCallback(vertex) {
	// 		if (vertex.edges && vertex.edges.length) {
	// 			edgeCounter += vertex.edges.length;
	// 			// console.log("edges " + edgeCounter);
	// 		}
	// 	},
	// 	function endCallback(err) {
	// 		if (err) {
	// 			console.log(err);
	// 		} else {
	// 			console.log("back-end counted " + JSON.stringify(edgeCounter) + " edges"
    //                         + "\n***********************************************************\n");
	// 			res.send(edgeCounter.toString());
	// 		}
	// 	}
	// );

});

// count total vertex
app.get('/countVertex/:graphName', (req, res) => {
	verticesDrawn = {};
    verticesDrawnArrayView = undefined;

	var graphName = req.params.graphName;
	console.log("graph to count vertex: " + graphName);
	db.collection('vertices').countDocuments({graph_name: graphName}, (err, count) => {
		if (err) {
			console.log(err);
		}
		console.log("count " + count + " vertices");

		res.send((count).toString());
	});
});

// query vertices of given graph
app.get('/queryGraphVertex/:graphName/:selectedPose/:vertexBatchSize/:iteration', (req, res) => {
	verticesToRespond = {};

	var graphName = req.params.graphName;
	var selectedPose = req.params.selectedPose;
	var vertexBatchSize = req.params.vertexBatchSize;
	var iteration = req.params.iteration;
	console.log("graph to query: " + graphName
                + "\nselected pose: " + selectedPose
				+ "\nbatch size: " + vertexBatchSize
				+ "\niteration: " + iteration);

	res.set('Content-Type', 'application/json');
	var cursor = db.collection('vertices').find({graph_name: graphName});

	cursor.skip(iteration * vertexBatchSize)
		  .limit(parseInt(vertexBatchSize, 10))
		  .forEach(function iterCallback(vertex) {
		  	// parse this batch of vertex
		  	parseVertex(vertex, selectedPose);
		  },
		  function endCallback(err) {
		  	if (err) {
		  		console.log(err);
		  	} else {
		  		// second pass: check if there is any vertex not drawn
		  		console.log("this batch of vertex parsed in back-end\n"
		  					+ "verticesToRespond size " + Object.keys(verticesToRespond).length
		  					+ "\nverticesDrawn size " + Object.keys(verticesDrawn).length);

		  		res.send(verticesToRespond);
		  	}
		  });

	// cursor = db.collection('vertices').find({graph_name: graphName});
	// cursor.skip(iteration * vertexBatchSize)
	// 	  .limit(parseInt(vertexBatchSize, 10))
	// 	  .stream()
	// 	  .pipe(JSONStream.stringify())
	// 	  .pipe(res);
});

/*
	verticesToRespond object
	{
		vid: {
			ori: [w, x, y, z],
			pos: [x, y, z],
			edges: [vid, ...]
		}
		.
		.
		.
	}

*/
var verticesToRespond; // record response for each batch query, reset in queryGraphVertex
var verticesDrawn; // record all vertices in this graph, reset in countVertex
var verticesDrawnArrayView; // provide an indexed view of verticesDrawn

/*
1, first pass, parse each vertex that belongs to this batch, compose key-val pair in its full format(i.e. w/ edges)
	in the verticesDrawn map, also put in verticesToRespond map
*/

// parse each vertex, in particular, extract its ori, pos, and edges
function parseVertex(vertex, selectedPose) {
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
		parsePoses(poses, selectedPose, extractFull);
	}

	// make sure ori and pos is not undefined
    if (extractFull["ori"] && extractFull["pos"]) {
        if (edges) {
            parseEdges(edges, extractFull);
        }
        verticesToRespond[vid] = extractFull;
        verticesDrawn[vid] = extractFull;
    } else {
        // console.log(vid + " does not have pose " + selectedPose);
    }
	// console.log("vid " + vid
	// 			+ "\nextractFull: " + JSON.stringify(verticesToRespond[vid]));
}

// extract ori, pos
function parsePoses(poses, selectedPose, extractFull) {
	var  ori, pos;

	for (var pose in poses) {
		if (pose === selectedPose) {
            ori = poses[pose].ori;
            pos = poses[pose].pos;
            if (ori && pos) {
                extractFull["ori"] = ori;
                extractFull["pos"] = pos;
                break;
            }
        }
	}
}

// extract "to" from edges array
function parseEdges(edges, extractFull) {
	for (var i = 0; i < edges.length; ++i) {
		extractFull["edges"].push(JSON.stringify(edges[i]["to"]));
	}
}

/*
    edgesToRespond structure
    {
        index: number,
        edgeCount: number,
        edges: [
                    {posFrom, posTo},
                    .
                    .
                    .
               ]
    }

 */
var edgesToRespond; // record response for each batch edge query, reset in queryGraphEdge

// query given graph's edges batch by batch
app.get('/queryGraphEdge/:graphName/:edgeBatchSize/:index', (req, res) => {
    // if the array view of verticesDrawn map is undefined, initialize it
    if (verticesDrawnArrayView === undefined) {
        verticesDrawnArrayView = Object.keys(verticesDrawn);
    }

    edgesToRespond = {"index": -1,
        "edgeCount" : 0,
        "edges": []};

    var graphName = req.params.graphName;
    var edgeBatchSize = req.params.edgeBatchSize;
    var index = req.params.index;

    // jump to the right index to collect edges

    for (index; index < verticesDrawnArrayView.length; ++index) {
        if (edgesToRespond["edges"].length < edgeBatchSize) {
            var vid = verticesDrawnArrayView[index];
            var fromPos = verticesDrawn[vid]["pos"];
            var edges = verticesDrawn[vid]["edges"];
            // console.log("vid " + vid + " has " + edges.length + " edges");

            var leadTo;
            for (var i = 0; i < edges.length; ++i) {
                leadTo = edges[i];
                // console.log("from " + vid + " to " + leadTo);

                // check if this vertex's neighbor is also drawn
                // as certain neighbors do not have selected pose
                if (verticesDrawn[leadTo]) {
                    var toPos = verticesDrawn[leadTo]["pos"];
                    edgesToRespond["edges"].push({"fromPos": fromPos, "toPos": toPos});
                }
            }

            if (edgesToRespond["edges"].length >= edgeBatchSize) {
                break;
            }
        }
    }
    edgesToRespond["index"] = index;
    edgesToRespond["edgeCount"] = edgesToRespond["edges"].length;
    res.send(edgesToRespond);
});

/*
    response structure
    {
        "fromPos": [x, y, z],
        "edges": {
                    vid: toPos,
                    .
                    .
                    .
                 }
    }
  */

// API for single vertex's neighbor query
app.get('/getVertexNeighbor/:graphName/:vid', (req, res) => {
   var graphName = req.params.graphName;
   var vid = req.params.vid;

   console.log("query graph " + graphName
                + "\nvid " + vid);

   if (verticesDrawn[vid]) {
       var response = {};
       response["fromPos"] = verticesDrawn[vid]["pos"];
       var edges = {};

       var leadTo;
       for (var i = 0; i < verticesDrawn[vid]["edges"].length; ++i) {
           leadTo = verticesDrawn[vid]["edges"][i];

           // check if this neighbor is drawn
           if (verticesDrawn[leadTo]) {
               edges[leadTo] = verticesDrawn[leadTo]["pos"];
           }
       }
       response["edges"] = edges;
       console.log("response object\n" + JSON.stringify(response));
       res.send(response);
   } else {
       console.log(vid + " is NOT drawn");
       res.sendStatus(404);
   }
});