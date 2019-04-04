import * as functions from 'firebase-functions';

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const scriptUpdated = functions.firestore.document('GameRequests/Games').onUpdate((change,context) =>{
    const data = change.after.data();

    if(data == undefined || data.read == "I was read")
    {
        return null;
    }

    //loop through requests
    // var names = [];
    // for(var i = 0; i < data.requests.length; i ++)
    // {
    //     names.push()
    // }

    // Then return a promise of a set operation to update the count
    return change.after.ref.set({
    read: "I was read",
    requests:[]
    }, {merge: true});
});
