document.addEventListener("DOMContentLoaded", event => {
    const app = firebase.app();
    console.log(app);
    const mainTable = document.querySelector("#mainTableBody");

    var currentWinner = '';
    var currentLoser = '';

    const db = firebase.firestore();
    const authVerification = db.collection('information').doc('authVerification');
    // below is a continous stream
    authVerification.onSnapshot(doc => {
        var data = doc.data();
        var connectionStatus = document.querySelector("#connectionStatus");
        connectionStatus.textContent = data.info;
        connectionStatus.classList.add("connectionSuccess");
    });

    // waits for changes in the database and updates table if any change happens
    db.collection("Players").orderBy("points", "desc").onSnapshot(doc =>{
        while(mainTable.firstChild){
            mainTable.removeChild(mainTable.firstChild);
        }
        var counter = 1;
        doc.forEach(function(entry){
            // add table row for each player
            let div = document.createElement('div');
            let row = document.createElement('tr');
            let head = document.createElement('th');
            let name = document.createElement('td');
            let points = document.createElement('td');
            let wins = document.createElement('td');
            let losses = document.createElement('td');
            let streak = document.createElement('td');

            let control = document.createElement('td');
            let winButton = document.createElement('button');
            let looseButton = document.createElement('button');
            winButton.classList.add('btn', 'btn-success', 'mx-2');
            winButton.textContent = "Won";
            winButton.addEventListener('click', function(){
                currentWinner = entry.data().name;
                if(checkGame(currentWinner,currentLoser))
                {
                    currentWinner = '';
                    currentLoser = '';
                }
            });
            looseButton.classList.add('btn', 'btn-danger', 'mx-2');
            looseButton.textContent = "Lost";
            looseButton.addEventListener('click', function(){
                currentLoser = entry.data().name;
                if(checkGame(currentWinner, currentLoser))
                {
                    currentLoser = '';
                    currentWinner = '';
                }
            });
            control.appendChild(winButton);
            control.appendChild(looseButton);

            div.classList.add("playerRow");
            head.textContent = counter++;
            name.textContent = entry.data().name;
            points.textContent = entry.data().points;
            wins.textContent = entry.data().wins;
            losses.textContent = entry.data().losses;
            streak.textContent = entry.data().currentStreak;

            wins.classList.add('d-none', 'd-sm-table-cell');
            losses.classList.add('d-none', 'd-sm-table-cell');
            streak.classList.add('d-none', 'd-md-table-cell');

            row.appendChild(head);
            row.appendChild(name);
            row.appendChild(points);
            row.appendChild(wins);
            row.appendChild(losses);
            row.appendChild(streak);
            row.appendChild(control);

            mainTable.appendChild(row);
        });
    });
});

const addPlayerForm = document.querySelector("#addPlayerForm");

addPlayerForm.addEventListener('submit', (e) =>{
    e.preventDefault();
    var name = addPlayerForm.name.value;
    var playerToAdd = firebase.firestore().collection("Players").doc(name);
    playerToAdd.get().then(doc =>{
        if(doc.exists)
        {
            alert("player already exists");
        }
        else
        {
            playerToAdd.set({
                name: name,
                points: 1500,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                maxStreak: 0,
                lastOpponent: '',
                notPlayedFor: 0
            })
            .then(function() {
                console.log("Document successfully written!");
            })
            .catch(function(error) {
                console.error("Error writing document: ", error);
            });
        }
    }).then((e)=>{
        addPlayerForm.name.value = '';
    });
});

const loginForm = document.querySelector("#loginForm");

loginForm.addEventListener('submit', (e) =>{
    e.preventDefault();
    firebase.auth().signInWithEmailAndPassword('loginuser@tablefootball.com', loginForm.password.value).catch(function(error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
    }).then(e =>{
        //reload page
        location.reload();
    });

    loginForm.password.value = '';
});

// function to check
// if a game is valid,
// how many points will be exchanged
// also exchanges points and updates players
function checkGame(winner, loser){
    if((winner != loser) && (winner != '') && (loser != '') && confirm("Did " + winner + " defeat " + loser + "?")){
        var db = firebase.firestore();
        var players = db.collection("Players");
        var gameInfo = db.collection("information").doc("gameInformation");
        var winningPlayer = players.doc(winner);
        var losingPlayer = players.doc(loser);
        //points of winning and losing player
        var winningPoints = 0;
        var losingPoints = 0;

        //wins and losses of winning/losing player respectively
        var winningWins = 0;
        var losingLosses = 0;

        //last opponents of winner/loser
        var winnerLastOpponent = '';
        var loserLastOpponent = '';

        //total number of games played
        var gamesPlayed = 0;

        // default decay calculation factor (how many game until we calculate decay)
        var decayCalculationFactor = 100;

        //streak calculation variables of winner
        //loser will just default to 0
        var winnerStreak = 0;
        var winnerMaxStreak = 0;

        // k and n variable of elo ranking, (check https://blog.mackie.io/the-elo-algorithm)
        var n = 0;
        var k = 0;

        // get results from the database and wait for them to return promises
        const promises = [];

        //get winning player points
        promises.push(winningPlayer.get().then(doc => {
            if(doc.exists){
                winningPoints = doc.data().points;
                winningWins = doc.data().wins + 1;
                winnerLastOpponent = doc.data().lastOpponent;
                winnerStreak = doc.data().currentStreak;
                winnerMaxStreak = doc.data().maxStreak;
            }
        }));

        //get losing player points
        promises.push(losingPlayer.get().then(doc => {
            if(doc.exists){
                losingPoints = doc.data().points;
                losingLosses = doc.data().losses + 1;
                loserLastOpponent = doc.data().lastOpponent;
            }
        }));

        // get general game info from database
        promises.push(gameInfo.get().then(doc =>{
            if(doc.exists){
                n = doc.data().n;
                k = doc.data().k;
                gamesPlayed = doc.data().gamesPlayed;
                decayCalculationFactor = doc.data().decayCalculationFactor;
            }
        }));
        // after all promises have been received we can continue with the
        // actual calculation of the program
        Promise.all(promises).then((e) => {
            //check if the game is actually valid from the data gathered:
            if(loserLastOpponent == winner || winnerLastOpponent == loser)
            {
                alert('Each player has to play at least someone else, before playing again');
                return;
            }
            //actually play a game

            // calculate new elo
            //get Elo parameters
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
            });
            losingPlayer.update({
                points: losingPoints,
                losses: losingLosses,
                lastOpponent: winner,
                notPlayedFor: 0,
                currentStreak: 0
            });
            gameInfo.update({
                gamesPlayed: gamesPlayed,
                games:firebase.firestore.FieldValue.arrayUnion(
                    {winner:winner,
                     loser:loser, 
                     winnerProbability:winnerExpected,
                     loserProbability:loserExpected,
                     gameNumber:gamesPlayed})
            });

            //update not played for value of players
            // we need to loop through every player,
            // count up and update our games
            players.get().then(allPlayers =>{
                allPlayers.forEach(player =>{
                    players.doc(player.data().name).update({
                        notPlayedFor: player.data().notPlayedFor + 1
                    });
                });
            }).then((e) => {
                if(gamesPlayed % decayCalculationFactor == 0){
                    calculateDecay();
                }
            });

            
        });
        return true;
    }
    return false;
}


function calculateDecay(){
    var db = firebase.firestore();
    var players = db.collection("Players");
    var gameInfo = db.collection("information").doc("gameInformation");
    var decayCutoffGames = 0;
    var decayPoints = 0; 
    var decayPlayersArray = [];
    var gainingPlayersArray = [];

    gameInfo.get().then(doc =>{
        if(doc.exists){
            decayCutoffGames = doc.data().decayCutoffGames;
            decayPoints = doc.data().decayPoints;
        }
    }).then((e) =>{
        decayPlayers = players.where("notPlayedFor", ">", decayCutoffGames);
        gainingPlayers = players.where("notPlayedFor", "<=", decayCutoffGames);

        const promises = [];
        promises.push(decayPlayers.get().then(players =>{
            players.forEach(player =>{
                // console.log("decay: " + player.data().name);
                decayPlayersArray.push({
                    name: player.data().name,
                    notPlayedFor: player.data().notPlayedFor,
                    currentPoints: player.data().points,
                });
            });
        }).catch(error =>{
            console.log(error);
        }));

        promises.push(gainingPlayers.get().then(players =>{
            players.forEach(player =>{
                // console.log("gain: " + player.data().name);
                gainingPlayersArray.push({
                    name: player.data().name,
                    notPlayedForInverted: decayCutoffGames - player.data().notPlayedFor,
                    currentPoints: player.data().points,
                });
            });
        }).catch(error =>{
            console.log(error);
        }));

        Promise.all(promises).then((e) =>{

            if(decayPlayersArray.length == 0 || decayPoints == 0)
            {
                console.log("aborting decay calculation");
                return
            }

            console.log("calculating decay points");
            
            // calculate all losses
            var totalNotPlayedFor = 0;
            var totalDecay = decayPoints * decayPlayersArray.length;
            var totalActualDecay = 0;
            for(var i = 0; i < decayPlayersArray.length; i ++)
            {
                totalNotPlayedFor += decayPlayersArray[i].notPlayedFor;
            }

            // console.log("Total decay not played for: " + totalNotPlayedFor);

            for(var i = 0; i < decayPlayersArray.length; i ++)
            {
                var percentage = decayPlayersArray[i].notPlayedFor/totalNotPlayedFor;
                // console.log(decayPlayersArray[i].name + ": " + percentage);
                var decayLosses = Math.round(percentage * totalDecay);
                totalActualDecay += decayLosses;
                decayPlayersArray[i].currentPoints -= decayLosses;
                //update database
                var currentPlayer = players.doc(decayPlayersArray[i].name);
                currentPlayer.update({
                    points: decayPlayersArray[i].currentPoints
                });
            }

            // calculate all gains
            var totalInvertedNotPlayedFor = 0;
            var totalGains = totalActualDecay;
            var totalActualGains = 0;

            // console.log("Total gains: " + totalGains);

            for(var i = 0; i < gainingPlayersArray.length; i ++)
            {
                totalInvertedNotPlayedFor += gainingPlayersArray[i].notPlayedForInverted; 
            }

            // console.log("Total inverted not played for: " + totalInvertedNotPlayedFor);

            for(var i = 0; i < gainingPlayersArray.length; i ++)
            {
                percentage = gainingPlayersArray[i].notPlayedForInverted/totalInvertedNotPlayedFor;
                decayGains = Math.round(percentage * totalGains);
                totalActualGains += decayGains;
                gainingPlayersArray[i].currentPoints += decayGains;
                // console.log(gainingPlayersArray[i].name + ": " + percentage);
                //update database
                var currentPlayer = players.doc(gainingPlayersArray[i].name);
                currentPlayer.update({
                    points: gainingPlayersArray[i].currentPoints
                });
            }

            // check if there are no runding errors, and if there are, adjust for them
            if(totalActualGains != totalActualDecay){
                
                var difference = totalActualDecay - totalActualGains;
                console.log("There is a difference in gains and decay, adjusting");
                // give difference to random player
                var luckyPick = gainingPlayersArray[0];

                players.doc(luckyPick.name).update({
                    points: luckyPick.currentPoints + difference
                });
            }
        });
    });
}