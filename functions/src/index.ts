import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const scriptUpdated = functions.firestore.document('GameRequests/{userId}').onCreate((snap,context) =>{
    const data = snap.data();
    if(data === undefined)
    {
        return null;
    }

    const winner = data.winner;
    const loser = data.loser;
    
    const players = admin.firestore().collection('Players');
    //var winningPoints = 0;
    const winningPlayer = players.doc(winner);
    // players.doc(winner).get().then(doc =>{
    //   if(doc.exists){
    //   }
    // });
    winningPlayer.get()
    .catch(err => console.log(err))
    .then(function(docRef){
      if(docRef !== undefined)
      {
        console.log(docRef.data());
      }
    })
    .catch(() => "obligatory catch");
    console.log(winningPlayer);
    
    return snap.ref.set({
    winner: winner,
    loser:loser,
    read:"This game was calculated"
    }, {merge: true});
});