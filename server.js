const dbClient = require('./connection.js');
const express = require('express');
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json());

app.listen(8080, () => {
    console.log("Server is now listening at port 8080")
})

dbClient.connect();

function getRequest() {
    app.get('/contacts', async (req,res)=>{
        try {
            const contacts = await getContacts();
            res.send(contacts);
        } catch (error) {
            console.error("Error fetching contacts:", error);
        }
    })
}

function identifyRequest() {
    app.post('/identify', async (req, res)=> {
        const newContact = req.body
        const contacts = await getContacts();
        const [linkedPhoneNumberContacts,linkedEmailContacts] = getLinkedContacts(newContact,contacts);
        const linkedContacts = linkedEmailContacts.concat(linkedPhoneNumberContacts)
        var linkedEmails = newContact.email!==null ? [newContact.email] : []
        var linkedPhoneNumbers = newContact.phoneNumber!==null ? [newContact.phoneNumber] : []
        var primaryContact = newContact
        var currTime = new Date()
        linkedContacts.forEach(linkedContact => {
            if(currTime > linkedContact.created_at) {
                primaryContact = linkedContact
                currTime = linkedContact.created_at
            }
            if(!linkedEmails.includes(linkedContact.email)) linkedEmails.push(linkedContact.email)
            if(!linkedPhoneNumbers.includes(linkedContact.phone_number)) linkedPhoneNumbers.push(linkedContact.phone_number)
        });
        var secondaryContactIds = []
        linkedContacts.forEach(linkedContact => {
            if(linkedContact.id != primaryContact.id) {
                if(!secondaryContactIds.includes(linkedContact.id)) secondaryContactIds.push(linkedContact.id)
                if(linkedContact.linked_id != primaryContact.id) updateContact(linkedContact,primaryContact)
            }
        });
        var consolidatedContact = {
            "contact": {
                "primaryContactId": primaryContact.id,
                "emails": linkedEmails,
                "phoneNumbers": linkedPhoneNumbers,
                "secondaryContactIds": secondaryContactIds
            }
        }
        
        if((newContact.email !== null && linkedEmailContacts.length == 0) || (newContact.phoneNumber !== null && linkedPhoneNumberContacts.length == 0)) {
            const currentTimestamp = new Date().toISOString();
            let insertQuery = `
                            INSERT INTO contacts(phone_number, email, linked_precedence, created_at, updated_at) 
                            VALUES(
                                ${newContact.phoneNumber !== null ? `'${newContact.phoneNumber}'` : 'NULL'},
                                ${newContact.email !== null ? `'${newContact.email}'` : 'NULL'},
                                'primary',
                                '${currentTimestamp}',
                                '${currentTimestamp}'
                            )
                            RETURNING id`;
            if(linkedContacts.length != 0) {
                insertQuery = `
                            INSERT INTO contacts(phone_number, email, linked_id, linked_precedence, created_at, updated_at) 
                            VALUES(
                                ${newContact.phoneNumber !== null ? `'${newContact.phoneNumber}'` : 'NULL'},
                                ${newContact.email !== null ? `'${newContact.email}'` : 'NULL'},
                                '${primaryContact.id}',
                                'secondary',
                                '${currentTimestamp}',
                                '${currentTimestamp}'
                            )
                            RETURNING id`;
            } 
            dbClient.query(insertQuery, (err, result)=>{
                if(!err){
                    if(linkedContacts.length==0) consolidatedContact.contact.primaryContactId = result.rows[0].id
                    if(linkedContacts.length) consolidatedContact.contact.secondaryContactIds.push(result.rows[0].id)
                    res.send(consolidatedContact)
                }
                else{ console.log(err.message) }
            })
            dbClient.end;
        } else {
            res.send(consolidatedContact)
        }    
    })
}

async function getContacts() {
    return new Promise((resolve, reject) => {
        dbClient.query(`SELECT * FROM contacts`, (err, result) => {
            if (err) {
                console.log(err)
                reject(err);
            } else {
                resolve(result.rows);
            }
        });
        dbClient.end;
    });
}

function getLinkedContacts(newContact, contacts) {
    const newEmail = newContact.email
    const newPhoneNumber = newContact.phoneNumber
    let emailLinkedIds = []
    contacts.forEach((contact) => {
        if(contact.email==newEmail) {
            let requiredId = contact.linked_precedence == 'primary' ? contact.id : contact.linked_id
            if(!emailLinkedIds.includes(requiredId)) emailLinkedIds.push(requiredId)
        }
    })
    let emailSame = []
    contacts.forEach((contact) => {
        let linkedId = contact.linked_precedence == 'primary' ? contact.id : contact.linked_id
        if(emailLinkedIds.includes(linkedId)) {
            if(!emailSame.includes(contact)) emailSame.push(contact)
        }
    })
    let phoneNumberLinkedIds = []
    contacts.forEach((contact) => {
        if(contact.phone_number==newPhoneNumber) {
            let requiredId = contact.linked_precedence == 'primary' ? contact.id : contact.linked_id
            if(!phoneNumberLinkedIds.includes(requiredId)) phoneNumberLinkedIds.push(requiredId)
        }
    })
    let phoneNumberSame = []
    contacts.forEach((contact) => {
        let linkedId = contact.linked_precedence == 'primary' ? contact.id : contact.linked_id
        if(phoneNumberLinkedIds.includes(linkedId)) {
            if(!phoneNumberSame.includes(contact)) phoneNumberSame.push(contact)
        }
    })
    return [phoneNumberSame,emailSame]
}

async function updateContact(contact,primaryContact) {
    return new Promise((resolve, reject) => {
        let currentTimestamp = new Date().toISOString()
        let updateQuery = `
                            UPDATE contacts
                            SET updated_at = '${currentTimestamp}',
                                linked_id = '${primaryContact.id}',
                                linked_precedence = 'secondary'
                            WHERE id = ${contact.id}`;
        dbClient.query(updateQuery, (err,result) => {
            if (err) {
                console.log("Error updating contact:",err)
            } else {
                resolve();
            }
        });
        dbClient.end;
    });
}

getRequest()
identifyRequest()

