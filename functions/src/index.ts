import * as functions from 'firebase-functions';

const Firestore = require('@google-cloud/firestore');

const firestore = new Firestore({
  projectId: process.env.GCP_PROJECT,
});

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const scriptUpdated = functions.firestore.document('GameRequests/{userId}').onCreate((snap,context) =>{
    const data = snap.data();
    if(data == undefined)
    {
        return null;
    }

    const winner = data.winner;
    const loser = data.loser;
    

    const winnerDocument = firestore.document("Players/"+winner);
    const loserDocument = firestore.document("Players/"+loser);

    return snap.ref.set({
    winner: winner,
    loser:loser,
    read:"This game was calculated"
    }, {merge: true});
});
