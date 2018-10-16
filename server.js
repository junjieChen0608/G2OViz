console.log('server running\nbuild 2.0');

const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const app = express();
// const JSONStream = require('JSONStream');

app.use(express.static('public'));
app.use(express.static(__dirname + '/build'));

let db;
const dbName = "test-hdmap";
const url = 'mongodb://localhost:27017/';

// connect to db "hdmap" and listen to 8080
MongoClient.connect(url,
					{useNewUrlParser: true}, (err, database) => {
	if (err) {
		return console.log(err);
	}

	db = database.db(dbName);

	app.listen(8080, () => {
		console.log('listening on 8080');
	});
});

// homepage
app.get('/', (req, res) => {
	console.log("dirname: " + __dirname);
	res.sendFile(__dirname + '/index.html');
});

// draw all edges after all vertices are drawn
app.get('/countEdge/:graphName', (req, res) => {
	var graphName = req.params.graphName;
	console.log("graph to count edge: " + graphName);


    var totalEdges = db.collection('graphs').findOne({name: graphName}, (err, graph) => {
        if (err) {
            console.log(err);
        }
        var totalEdges = graph["edges"];
        console.log(graphName + " has " + totalEdges + " edges");
        res.send(totalEdges.toString());
    });
});

// count total vertex
// TODO pass the vertex counter to front-end
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
			fullInfo: vertex object w/o edges
		}
		.
		.
		.
	}

*/
// record response for each batch query, reset in queryGraphVertex, passed to front-end
var verticesToRespond;

// record all vertices in this graph, reset in countVertex, stored in back-end
var verticesDrawn;

// provide an indexed view of verticesDrawn
var verticesDrawnArrayView;

// parse each vertex, in particular, extract its ori, pos, edges, and full vertex info w/o edges
function parseVertex(vertex, selectedPose) {
	var poses;
	// expand this data structure to extract more info of a vertex
	var extractFull = {"ori": undefined,
					   "pos": undefined,
					   "edges": [],
                       "fullInfo": undefined};

	var vid = vertex.id;
	// console.log("parsing " + vid);

	// iterate on all field in this vertex
	for (var item in vertex) {
		if (item === "poses") {
			poses = vertex[item];
		}
	}

	if (poses !== undefined) {
		parsePoses(poses, selectedPose, extractFull);
	}

	// make sure ori and pos is not undefined
    if (extractFull["ori"] !== undefined && extractFull["pos"] !== undefined) {
        verticesToRespond[vid] = extractFull;
        verticesDrawn[vid] = extractFull;
    } else {
        // console.log(vid + " does not have pose " + selectedPose);
    }

	// console.log("vid " + vid
	// 			+ "\nextractFull: " + JSON.stringify(verticesToRespond[vid]));

    extractFull["fullInfo"] = vertex;
    // console.log(JSON.stringify(extractFull["fullInfo"]));
}

// extract ori and pos of given pose
function parsePoses(poses, selectedPose, extractFull) {
	var  ori, pos;

	for (var pose in poses) {
		if (pose === selectedPose) {
            ori = poses[pose].orientation;
            pos = poses[pose].position;
            if (ori && pos) {
                extractFull["ori"] = ori;
                extractFull["pos"] = pos;
                break;
            }
        }
	}
}

/*
    edgesToRespond structure
    {
        index: number,
        edgeCount: number,
        edges: [
                    {fromPos: [x, y, z],
                     toPos: [x, y, z]},
                    .
                    .
                    .
               ]
    }

*/

// record response for each batch edge query, reset in queryGraphEdge
var edgesToRespond;

// query given graph's edges batch by batch
app.get('/queryGraphEdge/:graphName/:edgeBatchSize/:iteration', (req, res) => {
    edgesToRespond = [];

    var graphName = req.params.graphName;
    var edgeBatchSize = req.params.edgeBatchSize;
    var iteration = req.params.iteration;

    res.set('Content-Type', 'application/json');
    var cursor = db.collection('edges').find({graph_name: graphName});

    cursor.skip(iteration * edgeBatchSize)
          .limit(parseInt(edgeBatchSize, 10))
          .forEach(function iterCallback(edge) {
              edgesToRespond.push(edge);
          },
          function endCallback(err) {
             console.log("this batch of " + edgesToRespond.length + " edges is about to be returned");
             res.send(edgesToRespond);
          });
});

/*
    response structure
    {
        "fromPos": {ori: [w, x, y, z],
                    pos: [x, y, z]}
        "edges": {
                    vid: {ori: [w, x, y, z],
                          pos: [x, y, z],
                          fullEdgeInfo: edge object},
                    .
                    .
                    .
                 }
    }
*/

// API for single vertex's neighbor query
// TODO query neighbor edges of given vid, this needs pretty much another overhual
app.get('/getVertexNeighbor/:graphName/:vid', (req, res) => {
   var graphName = req.params.graphName;
   var vid = req.params.vid;

   console.log("query graph " + graphName
                + "\nvid " + vid);

   if (verticesDrawn[vid]) {
       var response = {};
       response["fromPos"] = {"ori": verticesDrawn[vid]["ori"],
                              "pos": verticesDrawn[vid]["pos"]};
       var edges = {};

       var leadTo;
       db.collection('vertices').findOne({graph_name: graphName, vid: parseInt(vid, 10)}, (err, result) => {
           if (err) {
               console.log(err);
           }

           var edgesFromDB = result["edges"];
           if (edgesFromDB === undefined) {
               edgesFromDB = [];
           }

           for (var i = 0; i < edgesFromDB.length; ++i) {
               leadTo = edgesFromDB[i]["to"];
               if (verticesDrawn[leadTo] !== undefined) {
                   edges[leadTo] = {"ori": verticesDrawn[leadTo]["ori"],
                                    "pos": verticesDrawn[leadTo]["pos"],
                                    "fullEdgeInfo": edgesFromDB[i]};
               }
           }

           response["edges"] = edges;
           // console.log("response object\n" + JSON.stringify(response));
           res.send(response);
       });

   } else {
       console.log(vid + " is NOT drawn");
       res.sendStatus(404);
   }
});