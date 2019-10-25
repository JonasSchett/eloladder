export function calculateDecay(players : FirebaseFirestore.CollectionReference, decayCutoffGames:number, decayPoints:number){
    const decayPlayersArray:{
      totalDecay:number,
      notPlayedFor:number,
      currentPoints:number,
      notPlayedForPercentage:number,
      scorePercentage:number,
      fullPercentage:number,
      name:string}[] = [];
    const gainingPlayersArray:{
      totalDecay:number,
      notPlayedForInverted:number,
      currentPoints:number,
      notPlayedForPercentage:number,
      scorePercentage:number,
      fullPercentage:number,
      name:string}[] = [];
    const allPlayers:{
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
          // only set decayplayers to players who are not frozen and who have more than 1000 points
          if(player.data().points > 1000 && !player.data().frozen)
          {
            decayPlayersArray.push({
              totalDecay: player.data().totalDecay,
              name: player.data().name,
              notPlayedFor: player.data().notPlayedFor,
              currentPoints: player.data().points,
              notPlayedForPercentage: 0,
              scorePercentage: 0,
              fullPercentage: 0
            });
          }
      });
    })
    .catch(err => console.log(err)));
  
    promises.push(gainingPlayers.get()
    .then(gainingPlayersData =>{
      gainingPlayersData.forEach(player =>{
        // only set gaining players to players who are not frozen and who have less than 2000 points
        if(player.data().points < 2000 && !player.data().frozen)
        {
          gainingPlayersArray.push({
            totalDecay: player.data().totalDecay,
            name: player.data().name,
            notPlayedForInverted: decayCutoffGames - player.data().notPlayedFor,
            currentPoints: player.data().points,
            scorePercentage: 0,
            notPlayedForPercentage: 0,
            fullPercentage: 0
           });
        }
      });
    })
    .catch(err => console.log(err)));
  
    promises.push(players.get()
    .then(playersData =>{
      playersData.forEach(player =>{
        // console.log("gain: " + player.data().name);
          if(!player.data().frozen)
          {
            allPlayers.push({
              name: player.data().name,
              currentPoints: player.data().points,
            });
          }  
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
  
      let totalPointsLess1000 = 0;
      let totalDistanceFrom2000 = 0;
      let totalNotPlayedFor = 0;
      let totalDecayPercentage = 0;
      let totalGainPercentage = 0;
  
      const totalDecay = decayPoints * decayPlayersArray.length;
      let totalActualDecay = 0;
  
      // initialise totals
      for(const player of allPlayers)
      {
        totalPointsLess1000 += (player.currentPoints - 1000);
        totalDistanceFrom2000 += (2000 - player.currentPoints);
      }
      for(const decayPlayer of decayPlayersArray)
      {
        totalNotPlayedFor += decayPlayer.notPlayedFor;
      }
  
      // calculate total decay percentage
      for(const decayPlayer of decayPlayersArray)
      {
        // calculating the decay like this will increase the decay with the factor of not having played,
        // while at the same time decreasing the decay with the distance the player is to 1000 points
        decayPlayer.scorePercentage = (decayPlayer.currentPoints - 1000) / totalPointsLess1000;
        decayPlayer.notPlayedForPercentage = decayPlayer.notPlayedFor/totalNotPlayedFor;
        decayPlayer.fullPercentage = decayPlayer.scorePercentage * decayPlayer.notPlayedForPercentage;
        // add to the total decay percentage
        totalDecayPercentage += decayPlayer.fullPercentage;
      }
  
      for(const decayPlayer of decayPlayersArray)
      {
        const percentage = decayPlayer.fullPercentage/totalDecayPercentage;
        console.log(decayPlayer.name + ": Percentage - " + percentage);
        const decayLosses = Math.round(percentage * totalDecay);
        totalActualDecay += decayLosses;
        decayPlayer.currentPoints -= decayLosses;
        individualDecay.push(decayLosses);
        //update database
        const currentPlayer = players.doc(decayPlayer.name);
        currentPlayer.update({
            points: decayPlayer.currentPoints,
            currentDecay: -decayLosses,
            totalDecay: decayPlayer.totalDecay - decayLosses
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
  
      for(const gainingPlayer of gainingPlayersArray)
      {
          // the closer a player is to 2000 the less points they will gain from decay
          gainingPlayer.scorePercentage = (2000 - gainingPlayer.currentPoints)/totalDistanceFrom2000;
          gainingPlayer.notPlayedForPercentage = gainingPlayer.notPlayedForInverted/totalInvertedNotPlayedFor;
          gainingPlayer.fullPercentage = gainingPlayer.scorePercentage * gainingPlayer.notPlayedForPercentage;
          totalGainPercentage += gainingPlayer.fullPercentage;
      }
  
      // console.log("Total inverted not played for: " + totalInvertedNotPlayedFor);
  
      for(const gainingPlayer of gainingPlayersArray)
      {
        const percentage = gainingPlayer.fullPercentage/totalGainPercentage;
        const decayGains = Math.round(percentage * totalGains);
        totalActualGains += decayGains;
        gainingPlayer.currentPoints += decayGains;
        individualGains.push(decayGains);
        console.log(gainingPlayer.name + ": Percentage - " + percentage);
        //update database
        const currentPlayer = players.doc(gainingPlayer.name);
        currentPlayer.update({
            points: gainingPlayer.currentPoints,
            currentDecay: decayGains,
            totalDecay: gainingPlayer.totalDecay + decayGains
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

export function calculateOldTable(players : FirebaseFirestore.CollectionReference, winnerOldRank:number)
{
  const player = players.where("prevRank", "==", winnerOldRank - 1);
  let playerAboveWinner = "";
  player.get()
  .then(playerData =>{
    playerData.forEach(doc =>{
      playerAboveWinner = doc.data().name;
    })
  })
  .catch(err => console.log(err))
  .then(x =>{
    players.doc(playerAboveWinner).update({
      prevRank: winnerOldRank
    })
    .catch(err => console.log(err));
  })
  .catch(err => console.log(err));
}
  
export function decayPreparation(promises: Promise<void | FirebaseFirestore.WriteResult>[], 
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
