import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const calculateDoubleMatch = functions.firestore.document('GameRequestsDoubles/{userId}').onCreate((snap,context) =>{
  const snapData = snap.data();
  if(snapData === undefined)
  {
      return null;
  }

  class Player {
    name:string;
    won:boolean;
    points:number;
    wins:number;
    losses:number;
    streak:number;
    maxStreak:number;
    constructor(name:string, won:boolean)
    {
      this.name = name;
      this.won = won;
      this.points = 0;
      this.wins = 0;
      this.losses = 0;
      this.streak = 0;
      this.maxStreak = 0;
    }
  }

  let n = 0;
  let k = 0;
  let gamesPlayed = 0;
  let decayCalculationFactor = 100;
  let decayCutoffGames = 100;
  let decayPoints = 0;

  const winner1 = snapData.winner1;
  const winner2 = snapData.winner2;
  const loser1 = snapData.loser1;
  const loser2 = snapData.loser2;

  const losers = [new Player(loser1,false),new Player(loser2,false)];
  const winners = [new Player(winner1,true),new Player(winner2,true)];
  const allPlayers:Player[] = [];
  allPlayers.push(...losers);
  allPlayers.push(...winners);

  let winningTeamPoints = 0;
  let losingTeamPoints = 0;

  const players = admin.firestore().collection('Players');
  const info = admin.firestore().collection('information');
  //var winningPoints = 0;
  const gameInfo = info.doc('gameInformation');

  const promises = [];

  console.log("Doubles beginning log:");
  for(const player of allPlayers)
  {
    const currentPlayer = players.doc(player.name);
    promises.push(currentPlayer.get()
    .catch(err => console.log(err))
    .then(doc => {
      if(doc !== undefined){
        const data = doc.data();
        if(data !== undefined)
        {
          if(player.won)
          {
            player.points = data.points;
            winningTeamPoints += player.points;
            player.wins = data.wins + 1;
            player.losses = data.losses;
            player.streak = data.currentStreak + 1;
            player.maxStreak = player.streak > data.maxStreak ? player.streak : data.maxStreak;
          }
          else
          {
            player.points = data.points;
            losingTeamPoints += player.points;
            player.wins = data.wins;
            player.losses = data.losses + 1;
            player.streak = 0;
            player.maxStreak = data.maxStreak;
          }
          console.log("Player: " + player.name + " Points: "+ player.points + " Won: " + player.won);
        }
      }
    })
    .catch(err => console.log(err)));
  }

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
          decayCalculationFactor = data.decayCalculationFactor;
          decayCutoffGames = data.decayCutoffGames;
          decayPoints = data.decayPoints;
          console.log("DecayFactor: "+ decayCalculationFactor+ " cutoffgames: " + decayCutoffGames + " decayPoints: " + decayPoints);
        }
      }
    })
    .catch(err => console.log(err))
  );

  Promise.all(promises)
  .catch(err => console.log(err))
  .then((e) =>{

    gamesPlayed = gamesPlayed + 1;
    const x  = winningTeamPoints - losingTeamPoints;
    const exponent = -(x/n);
    const winnerExpected = 1/(1+Math.pow(10,exponent));
    const loserExpected = 1-winnerExpected;
    const winnerAddition = Math.round(k * (1-winnerExpected));
    const loserDeduction = Math.round(k * (0-loserExpected));

    console.log("Winneraddition: "+ winnerAddition+" LoserDeduction: "+loserDeduction);

    // winner addition and loser deduction will be applied to the players here
    // each player will gain/lose the amount of points calculated.
    // This effectively gives a doubles match the same score per player as a singles match.
    // the points are also normalised accross the teams
    // the person with more points pays more in case of a loss
    // the person with more gains less in case of a win

    // Below is some logging of the split among winner and loser
    const winner1Addition = Math.round(winnerAddition * 2 * (winners[1].points / winningTeamPoints));
    const winner2Addition = Math.round(winnerAddition * 2 * (winners[0].points / winningTeamPoints));
    const loser1Addition = Math.round(loserDeduction * 2 * (losers[1].points / losingTeamPoints));
    const loser2Addition = Math.round(loserDeduction * 2 * (losers[0].points / losingTeamPoints));
    console.log("Winner split: Winner1: " + winner1Addition + " Winner2: "+ winner2Addition);
    console.log("Loser split: Loser1: " + loser1Addition + " Loser2: "+ loser2Addition);
    winners[0].points += winner1Addition;
    winners[1].points += winner2Addition;
    losers[0].points += loser1Addition;
    losers[1].points += loser2Addition;

    console.log("Doubles endning log:");
    const innerPromises = [];
    for(const player of allPlayers)
    {
      const currentPlayer = players.doc(player.name);
      
      console.log("Player: " + player.name + " Points: "+ player.points + " Won: " + player.won);
      innerPromises.push(currentPlayer.update({
        points: player.points,
        wins: player.wins,
        losses: player.losses,
        notPlayedFor: 0,
        currentStreak: player.streak, 
        maxStreak : player.maxStreak
      })
      .catch(err => console.log(err)));
    }

    innerPromises.push(gameInfo.update({
        gamesPlayed: gamesPlayed,
    })
    .catch(err => console.log(err)));

    innerPromises.push(snap.ref.update({
      winner1:winner1,
      winner2:winner2,
      loser1:loser1,
      loser2:loser2,
      winnerTeamExpectations:winnerExpected,
      loserTeamExpectations:loserExpected,
      winner1Gains:winner1Addition,
      winner2Gains:winner2Addition,
      loser1Losses:loser1Addition,
      loser2Losses:loser2Addition,
      info:"Game was calculated, all data added"
    })
    .catch(err => console.log(err)));

    //calculate decay
    decayPreparation(innerPromises,players,gamesPlayed,decayCalculationFactor,decayCutoffGames,decayPoints);
  })
  .catch(err => console.log(err));
  return snap.ref.update({
    info:"Game was calculated"
    });
});

export const playerAdded = functions.firestore.document('PlayerAddRequests/{userId}').onCreate((snap,context) =>{
  const snapData = snap.data();
  if(snapData === undefined)
  {
      return null;
  }

  const name = snapData.name;

  const players = admin.firestore().collection("Players")
  const playerToAdd = players.doc(name);
  playerToAdd.get().then(doc =>{
      if(doc.exists)
      {
        return null;
      }
      else
      {
        players.doc(name).set({
          name: name,
          points: 1500,
          wins: 0,
          losses: 0,
          currentStreak: 0,
          maxStreak: 0,
          lastOpponent: '',
          notPlayedFor: 0
        })
        .catch(err => console.log(err));
        return;
      }
  })
  .catch(err => console.log(err));
  return snap.ref.set({
    name: name,
    added:"Player was successfully added"
    }, {merge: true});
});

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
  let decayCalculationFactor = 100;
  let decayCutoffGames = 0;
  let decayPoints = 0;
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
          decayCalculationFactor = data.decayCalculationFactor;
          decayCutoffGames = data.decayCutoffGames;
          decayPoints = data.decayPoints;
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
    const winnerAddition = Math.round(k * (1-winnerExpected));
    const loserDeduction = Math.round(k * (0-loserExpected));

    console.log("Winneraddition: "+ winnerAddition+" LoserDeduction: "+loserDeduction);

    winningPoints = winningPoints + winnerAddition;
    losingPoints = losingPoints + loserDeduction;
    winnerStreak += 1;
    winnerMaxStreak = winnerStreak > winnerMaxStreak ? winnerStreak : winnerMaxStreak;

    const innerPromises = [];
    innerPromises.push(winningPlayer.update({
        points: winningPoints,
        wins: winningWins,
        lastOpponent: loser,
        notPlayedFor: 0,
        currentStreak: winnerStreak, 
        maxStreak : winnerMaxStreak
    })
    .catch(err => console.log(err)));
    innerPromises.push(losingPlayer.update({
        points: losingPoints,
        losses: losingLosses,
        lastOpponent: winner,
        notPlayedFor: 0,
        currentStreak: 0
    })
    .catch(err => console.log(err)));
    innerPromises.push(gameInfo.update({
        gamesPlayed: gamesPlayed,
    })
    .catch(err => console.log(err)));

    innerPromises.push(snap.ref.update({
      winner: winner,
      loser:loser,
      winnerExpectations:winnerExpected,
      loserExpectaions:loserExpected,
      winnerGain:winnerAddition,
      loserLoss:loserDeduction,
      info:"Game was calculated, all data added"
      })
      .catch(err => console.log(err)));

    //update not played for value of players
    // we need to loop through every player,
    // count up and update our games
    decayPreparation(innerPromises,players,gamesPlayed,decayCalculationFactor,decayCutoffGames,decayPoints);
  })
  .catch(err => console.log(err));
  return snap.ref.update({
    info:"Game was calculated"
    });
});

function calculateDecay(players : FirebaseFirestore.CollectionReference, decayCutoffGames:number, decayPoints:number){
  const decayPlayersArray:{
    notPlayedFor:number,
    currentPoints:number,
    name:string}[] = [];
  const gainingPlayersArray:{
    notPlayedForInverted:number,
    currentPoints:number,
    name:string}[] = [];

  const decayPlayers = players.where("notPlayedFor", ">", decayCutoffGames);
  const gainingPlayers = players.where("notPlayedFor", "<=", decayCutoffGames);

  const individualDecay:number[] = [];
  const individualGains:number[] = [];

  const promises = [];
  promises.push(decayPlayers.get()
  .then(decayPlayersData =>{
    decayPlayersData.forEach(player =>{
        // console.log("decay: " + player.data().name);
        decayPlayersArray.push({
            name: player.data().name,
            notPlayedFor: player.data().notPlayedFor,
            currentPoints: player.data().points,
        });
    });
  })
  .catch(err => console.log(err)));

  promises.push(gainingPlayers.get()
  .then(gainingPlayersData =>{
    gainingPlayersData.forEach(player =>{
      // console.log("gain: " + player.data().name);
      gainingPlayersArray.push({
          name: player.data().name,
          notPlayedForInverted: decayCutoffGames - player.data().notPlayedFor,
          currentPoints: player.data().points,
      });
    });
  })
  .catch(err => console.log(err)));

  Promise.all(promises)
  .then((e) =>{
    

    if(decayPlayersArray.length === 0 || decayPoints === 0)
    {
      console.log("aborting decay calculation");
      return;
    }

    console.log("calculating decay points");
    console.log("DecayPoints: " + decayPoints + " DecayCutoff: "+ decayCutoffGames);
    console.log(gainingPlayersArray);
    console.log(decayPlayersArray);
    
    // calculate all losses
    let totalNotPlayedFor = 0;
    const totalDecay = decayPoints * decayPlayersArray.length;
    let totalActualDecay = 0;
    for(const decayPlayer of decayPlayersArray)
    {
      totalNotPlayedFor += decayPlayer.notPlayedFor;
    }

    // console.log("Total decay not played for: " + totalNotPlayedFor);

    for(const decayPlayer of decayPlayersArray)
    {
      const percentage = decayPlayer.notPlayedFor/totalNotPlayedFor;
      // console.log(decayPlayersArray[i].name + ": " + percentage);
      const decayLosses = Math.round(percentage * totalDecay);
      totalActualDecay += decayLosses;
      decayPlayer.currentPoints -= decayLosses;
      individualDecay.push(decayLosses);
      //update database
      const currentPlayer = players.doc(decayPlayer.name);
      currentPlayer.update({
          points: decayPlayer.currentPoints
      })
      .catch(err => console.log(err)); 
    }

    // calculate all gains
    let totalInvertedNotPlayedFor = 0;
    const totalGains = totalActualDecay;
    let totalActualGains = 0;

    // console.log("Total gains: " + totalGains);

    for(const gainingPlayer of gainingPlayersArray)
    {
        totalInvertedNotPlayedFor += gainingPlayer.notPlayedForInverted; 
    }

    // console.log("Total inverted not played for: " + totalInvertedNotPlayedFor);

    for(const gainingPlayer of gainingPlayersArray)
    {
      const percentage = gainingPlayer.notPlayedForInverted/totalInvertedNotPlayedFor;
      const decayGains = Math.round(percentage * totalGains);
      totalActualGains += decayGains;
      gainingPlayer.currentPoints += decayGains;
      individualGains.push(decayGains);
      // console.log(gainingPlayersArray[i].name + ": " + percentage);
      //update database
      const currentPlayer = players.doc(gainingPlayer.name);
      currentPlayer.update({
          points: gainingPlayer.currentPoints
      })
      .catch(err => console.log(err));
    }

    console.log("Total Gains: "  + totalActualGains  + " Total decay: " + totalActualDecay);
    console.log(individualGains);
    console.log(individualDecay);

    // check if there are no runding errors, and if there are, adjust for them
    if(totalActualGains !== totalActualDecay){ 
      const difference = totalActualDecay - totalActualGains;
      console.log("There is a difference in gains and decay, adjusting: " + difference);
      // give difference to random player
      const luckyPick = gainingPlayersArray[0];

      players.doc(luckyPick.name).update({
          points: luckyPick.currentPoints + difference
      })
      .catch(err => console.log(err));
    }
  })
  .catch(err => console.log(err));
}

function decayPreparation(promises: Promise<void | FirebaseFirestore.WriteResult>[], 
                          players:FirebaseFirestore.CollectionReference, 
                          gamesPlayed:number, 
                          decayCalculationFactor:number,
                          decayCutoffGames:number,
                          decayPoints:number)
{
  Promise.all(promises)
    .then(function(){
      let totalScore = 0;
      players.get()
      .then(allPlayers =>{
        allPlayers.forEach(player =>{
          totalScore += player.data().points;
          players.doc(player.data().name)
          .update({
              notPlayedFor: player.data().notPlayedFor + 1
          })
          .catch(err => console.log(err))
        });
      })
      .catch(err => console.log(err))
      .then(function(){
          console.log("Current total score: " + totalScore);
          if(gamesPlayed % decayCalculationFactor === 0){
              calculateDecay(players, decayCutoffGames, decayPoints);
          }
      })
      .catch(err => console.log(err));
    })
    .catch(err => console.log(err));
}