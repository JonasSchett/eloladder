import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as helper from './helper-functions'
admin.initializeApp();


// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const calculateDoubleMatch = functions.firestore.document('GameRequestsDoubles/{userId}').onCreate((snap,context) =>{
  const snapData = snap.data();
  if(snapData === undefined)
  {
      return null;
  }

  // player class used for every player
  // this stores points and is simpler to use in a more than
  // two player setup, the rest works as in the singles match
  // except for the elo calculation,
  // the elo here uses the sum of both players as a baseline
  class Player {
    name:string;
    won:boolean;
    points:number;
    wins:number;
    losses:number;
    streak:number;
    maxStreak:number;
    pointGain:number;
    constructor(name:string, won:boolean)
    {
      this.name = name;
      this.won = won;
      this.points = 0;
      this.wins = 0;
      this.losses = 0;
      this.streak = 0;
      this.maxStreak = 0;
      this.pointGain = 0;
    }
  }

  // general values used for calculation elo score etc
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

  // get data for each player
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
    const winner1Addition = Math.round(winnerAddition * (winners[1].points / winningTeamPoints));
    const winner2Addition = Math.round(winnerAddition * (winners[0].points / winningTeamPoints));
    const loser1Addition = Math.round(loserDeduction * (losers[0].points / losingTeamPoints));
    const loser2Addition = Math.round(loserDeduction * (losers[1].points / losingTeamPoints));
    console.log("Winner split: Winner1: " + winner1Addition + " Winner2: "+ winner2Addition);
    console.log("Loser split: Loser1: " + loser1Addition + " Loser2: "+ loser2Addition);
    winners[0].pointGain = winner1Addition;
    winners[1].pointGain = winner2Addition;
    losers[0].pointGain = loser1Addition;
    losers[1].pointGain = loser2Addition;

    console.log("Doubles endning log:");
    const innerPromises = [];
    for(const player of allPlayers)
    {
      const currentPlayer = players.doc(player.name);
      
      console.log("Player: " + player.name + " Points: "+ player.points + " Won: " + player.won);
      innerPromises.push(currentPlayer.update({
        points: player.points + player.pointGain,
        wins: player.wins,
        losses: player.losses,
        notPlayedFor: 0,
        currentStreak: player.streak, 
        maxStreak : player.maxStreak,
        lastResult: player.won,
        pointGain: player.pointGain
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
    helper.decayPreparation(innerPromises,players,gamesPlayed,decayCalculationFactor,decayCutoffGames,decayPoints);
  })
  .catch(err => console.log(err));
  return snap.ref.update({
    info:"Game was calculated",
    timeStamp: new Date().getTime()
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
  let playersLength = 100;
  let firstPlayer = false;
  // first, get the length of the players to 
  // calculate the prevRank
  players.get().then(playersData =>{
    playersLength = playersData.size;
    if(playersLength === 0)
    {
      firstPlayer = true;
    }
  })
  .catch(err => console.log(err))
  .then( x =>{
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
          notPlayedFor: 0,
          prevRank: playersLength + 1,
          pointGain: 0,
          lastResult: false,
          isChampion: firstPlayer,
          currentDecay: 0,
          totalDecay: 0,
          frozen: false
        })
        .catch(err => console.log(err));
        return;
      }
    })
    .catch(err => console.log(err));
  })
  .catch(err => console.log(err));
  
  return snap.ref.set({
    name: name,
    added:"Player was successfully added"
    }, {merge: true});
});

export const calculateSingleMatch = functions.firestore.document('GameRequests/{userId}').onCreate((snap,context) =>{
  const snapData = snap.data();
  if(snapData === undefined)
  {
      return null;
  }

  // initial gathering of data references of winner and loser
  const winner = snapData.winner;
  const loser = snapData.loser;
  
  // getting data from the 'Players' collection
  // and the 'information' collection as that 
  // is where relevant variables as well
  // as the player data is stored
  const players = admin.firestore().collection('Players');
  const info = admin.firestore().collection('information');

  // get links to the document we can read 
  // this accesses the winner and loser document in the database
  const winningPlayer = players.doc(winner);
  const losingPlayer = players.doc(loser);

  // get the gameInformation document within the information collection
  const gameInfo = info.doc('gameInformation');

  // initialisation of points and values required for calculation
  let winningPoints = 0;
  let losingPoints = 0;

  // wins of winner and loser
  let winningWins = 0;
  let losingLosses = 0;

  // last opponents of winner and loser
  let winnerLastOpponent = '';
  let loserLastOpponent = '';

  // streak and max streak of winner as they could be changed
  let winnerStreak = 0;
  let winnerMaxStreak = 0;

  // see if the winner or loser are champion for transfer of title
  let loserIsChampion = false;
  let winnerIsChampion = false;

  // n and k values used for the calculation
  // as well as more values required
  // gamesPlayed - total number of games played ever
  // decayCalculationFactor - after how many games decay is calculated
  // decayCutoffGames - number of games from which a player has to be absent in order to be hit by decay
  // decayPoints - average number of points given by each player hit by decay

  let n = 0;
  let k = 0;
  let gamesPlayed = 0;
  let decayCalculationFactor = 100;
  let decayCutoffGames = 0;
  let decayPoints = 0;

  // winnerPrevRank - previous rank of winner in alternative table rules
  // loserPrevRank - same as above for loser
  let winnerPrevRank = 0;
  let loserPrevRank = 0;

  //get winning player data
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
          winnerPrevRank = data.prevRank;
          winnerIsChampion = data.isChampion;
        }
      }
    })
    .catch(err => console.log(err))
  );

  //get losing player data
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
          loserIsChampion = data.isChampion;
          loserPrevRank = data.prevRank;
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

  // wait for all previous reads to finish before starting the calculation
  Promise.all(promises)
  .catch(err => console.log(err))
  .then((e) =>{
    if(winnerLastOpponent === loser || loserLastOpponent === winner)
    {
      return;
    }
    //update the alternative table with alternative rules
    if(loserPrevRank < winnerPrevRank)
    {
      helper.calculateOldTable(players,winnerPrevRank);
      winnerPrevRank -= 1;
    }

    // update total number of games played
    gamesPlayed = gamesPlayed + 1;

    // Elo calculations
    const x  = winningPoints - losingPoints;
    const exponent = -(x/n);
    const winnerExpected = 1/(1+Math.pow(10,exponent));
    const loserExpected = 1-winnerExpected;
    const winnerAddition = Math.round(k * (1-winnerExpected));
    const loserDeduction = Math.round(k * (0-loserExpected));
    
    //Need to see if the winner will remain/become champion
    const makeWinnerChampion = loserIsChampion || winnerIsChampion;

    console.log("Winneraddition: "+ winnerAddition+" LoserDeduction: "+loserDeduction);
    console.log("Loser is champion: " + loserIsChampion + " Winner is champion: "+ winnerIsChampion);

    // create resulting points
    winningPoints = winningPoints + winnerAddition;
    losingPoints = losingPoints + loserDeduction;
    // streak of winner is updated
    winnerStreak += 1;
    winnerMaxStreak = winnerStreak > winnerMaxStreak ? winnerStreak : winnerMaxStreak;

    // update files and documents on database
    const innerPromises = [];
    innerPromises.push(winningPlayer.update({
        points: winningPoints,
        wins: winningWins,
        lastOpponent: loser,
        notPlayedFor: 0,
        currentStreak: winnerStreak, 
        maxStreak : winnerMaxStreak,
        lastResult : true,
        pointGain : winnerAddition,
        isChampion : makeWinnerChampion,
        prevRank : winnerPrevRank
    })
    .catch(err => console.log(err)));
    innerPromises.push(losingPlayer.update({
        points: losingPoints,
        losses: losingLosses,
        lastOpponent: winner,
        notPlayedFor: 0,
        currentStreak: 0,
        lastResult: false,
        pointGain : loserDeduction,
        isChampion : false,
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
    

    // finally we need to do decay preparation and check if we actually start calculating decay
    helper.decayPreparation(innerPromises,players,gamesPlayed,decayCalculationFactor,decayCutoffGames,decayPoints);
  })
  .catch(err => console.log(err));
  return snap.ref.update({
    info:"Game was calculated",
    timeStamp: new Date().getTime()
    });
});

//function to initialise the database
export const initialiseDatabase = functions.firestore.document('Initialisation/{name}').onCreate((snap, context) =>{
  const snapData = snap.data();
  if(snapData === undefined)
  {
      return null;
  }
  const information = admin.firestore().collection("information")
  const playerAddRequests = admin.firestore().collection('PlayerAddRequests');
  const authVerification = information.doc("authVerification");
  const gameInformation = information.doc("gameInformation");
  let firstPlayerName = snapData.name;
  if(firstPlayerName === undefined)
  {
    firstPlayerName = "First Player, you can probably delete this"
  }

  playerAddRequests.doc().set({
    name: firstPlayerName
  })
  .catch(err => console.log(err));

  authVerification.get().then(doc =>{
    if(doc.exists)
    {
      return null;
    }
    else
    {
      information.doc("authVerification").set({
        info: "connected" 
      })
      .catch(err => console.log(err));
      return;
    }
  })
  .catch(err => console.log(err));

  gameInformation.get().then(doc =>{
    if(doc.exists)
    {
      return null;
    }
    else
    {
      information.doc("gameInformation").set({
        decayCalculationFactor: 2,
        decayCutoffGames: 8,
        decayPoints: 0,
        gamesPlayed: 0,
        k: 40,
        n: 400,
      })
      .catch(err => console.log(err));
      return;
    }
  })
  .catch(err => console.log(err));

  return snap.ref.update({
    info:"Database initialised",
    timestamp : new Date().getTime()
  })
});