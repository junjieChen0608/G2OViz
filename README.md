##Pre-requisite
You will need the following software installed in your system
to use this project.

**MongoDB**

[[https://docs.mongodb.com/master/tutorial/install-mongodb-on-ubuntu/?_ga=2.57525421.604803410.1537355422-2022223102.1534571995 | official installation guide]]

**node.js**

```
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
```

== Install npm dependencies under G2OViz root directory ==

```npm install```

##Things to note
* By default, the server uses "test-hdmap" as the MongoDB database, if you are using a different name for your database, you might want to change dbName in server.js.
* Collections under hdmap are bags, graphs, vertices.
* Server is listening to localhost: 8080.
* Server connects mongodb at localhost: 27017.

##How to use this project
1) Make sure you are in root directory of G2OViz
2) run the node app

```node server.js```

in your terminal, if everything is corret, it will say "server running, listening to 8080"
3) open your favorite browser and go to http://localhost:8080/
4) type in the graph name you want to render and choose a pose
5) click render button or hit enter key

##Interact with the visualizer
* Rotate: left mouse button
* Pan: right mouse button
* Zoom: mouse scroll, or hold mouse scroll and move mouse back and forth
* Mode switch: press **x** on your keyboard to switch between **control mode** and **select mode**

**What is control mode?**

It allows you rotate, pan, and zoom the canvas.

**And what about select mode?**

It enables you to click on vertices and examine their details.