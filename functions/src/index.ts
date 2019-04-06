import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const scriptUpdated = functions.firestore.document('GameRequests/{userId}').onCreate((snap,context) =>{
  const snapData = snap.data();
  if(snapData === undefined)
  {
      return null;
  }

  const winner = snapData.winner;
  const loser = snapData.loser;
  
  const players = admin.firestore().collection('Players');
  const info = admin.firestore().collection('information');
  //var winningPoints = 0;
  const winningPlayer = players.doc(winner);
  const losingPlayer = players.doc(loser);
  const gameInfo = info.doc('gameInformation');

  let winningPoints = 0;
  let losingPoints = 0;
  let winningWins = 0;
  let losingLosses = 0;
  let winnerLastOpponent = '';
  let loserLastOpponent = '';
  let winnerStreak = 0;
  let winnerMaxStreak = 0;

  let n = 0;
  let k = 0;
  let gamesPlayed = 0;
  //let decayCalculationFactor = 100;
  // players.doc(winner).get().then(doc =>{
  //   if(doc.exists){
  //   }
  // });
  //get winning player points
  const promises = [];
  promises.push(winningPlayer.get()
    .catch(err => console.log(err))
    .then(doc => {
      if(doc !== undefined){
        const data = doc.data();
        if(data !== undefined)
        {
          winningPoints = data.points;
          winningWins = data.wins + 1;
          winnerLastOpponent = data.lastOpponent;
          winnerStreak = data.currentStreak;
          winnerMaxStreak = data.maxStreak;
        }
      }
    })
    .catch(err => console.log(err))
  );

  //get losing player points
  promises.push(losingPlayer.get()
    .catch(err => console.log(err))
    .then(doc => {
      if(doc !== undefined){
        const data = doc.data();
        if(data !== undefined)
        {
          losingPoints = data.points;
          losingLosses = data.losses + 1;
          loserLastOpponent = data.lastOpponent;
        }
      }
    })
    .catch(err => console.log(err))
  );

  // get general game info from database
  promises.push(gameInfo.get()
    .catch(err => console.log(err))
    .then(doc =>{
      if(doc !== undefined){
        const data = doc.data();
        if(data !== undefined)
        {
          n = data.n;
          k = data.k;
          gamesPlayed = data.gamesPlayed;
          //decayCalculationFactor = data.decayCalculationFactor;
        }
      }
    })
    .catch(err => console.log(err))
  );

  Promise.all(promises)
  .catch(err => console.log(err))
  .then((e) =>{
    if(winnerLastOpponent === loser || loserLastOpponent === winner)
    {
      return;
    }

    gamesPlayed = gamesPlayed + 1;
    const x  = winningPoints - losingPoints;
    const exponent = -(x/n);
    const winnerExpected = 1/(1+Math.pow(10,exponent));
    const loserExpected = 1-winnerExpected;
    winningPoints = Math.round(winningPoints + k * (1-winnerExpected));
    losingPoints = Math.round(losingPoints + k * (0-loserExpected));
    winnerStreak += 1;
    winnerMaxStreak = winnerStreak > winnerMaxStreak ? winnerStreak : winnerMaxStreak;

    winningPlayer.update({
        points: winningPoints,
        wins: winningWins,
        lastOpponent: loser,
        notPlayedFor: 0,
        currentStreak: winnerStreak, 
        maxStreak : winnerMaxStreak
    })
    .catch(err => console.log(err));
    losingPlayer.update({
        points: losingPoints,
        losses: losingLosses,
        lastOpponent: winner,
        notPlayedFor: 0,
        currentStreak: 0
    })
    .catch(err => console.log(err));
    gameInfo.update({
        gamesPlayed: gamesPlayed,
        // games:firebase.firestore.FieldValue.arrayUnion(
        //     {
        //         winner:winner,
        //         loser:loser, 
        //         winnerProbability:winnerExpected,
        //         loserProbability:loserExpected,
        //         gameNumber:gamesPlayed
        //     })
    })
    .catch(err => console.log(err));
    //update not played for value of players
    // we need to loop through every player,
    // count up and update our games
    // players.get().then(allPlayers =>{
    //   allPlayers.forEach(player =>{
    //       players.doc(player.data().name).update({
    //           notPlayedFor: player.data().notPlayedFor + 1
    //       });
    //   });
    // }).then((e) => {
    //     if(gamesPlayed % decayCalculationFactor == 0){
    //         calculateDecay();
    //     }
    // });
  })
  .catch(err => console.log(err))
  
  return snap.ref.set({
  winner: winner,
  loser:loser,
  read:"This game was calculated"
  }, {merge: true});
});