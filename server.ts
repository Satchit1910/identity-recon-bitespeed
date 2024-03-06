const dbClient = require('./connection.ts');
const express = require('express');
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json());

app.listen(8080, () => {
    console.log("Server is now listening at port 8080")
})

dbClient.connect();

function getRequests() {
    app.get('/contacts', async (req, res)=>{
        try {
            const contacts = await getContacts();
            res.send(contacts);
        } catch (error) {
            console.error("Error fetching contacts:", error);
        }
    })
}

async function identifyRequest() {
    app.post('/identify', async (req, res)=> {
        const user = req.body
        const contacts = await getContacts();
        console.log(contacts);
        
    })
}

async function getContacts() {
    return new Promise((resolve, reject) => {
        dbClient.query(`SELECT * FROM contacts`, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result.rows);
            }
        });
        dbClient.end;
    });
}

getRequests()
identifyRequest()

