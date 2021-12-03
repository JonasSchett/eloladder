// Javascript file responsible for handling user inputs and displaying data
var doubles = false;

var currentWinners = [];
var currentLosers = [];

// selectors for main objects on page
const mainTable = document.querySelector("#mainTableBody");
const singlesTable = document.querySelector("#singlesTableBody");
const doublesTable = document.querySelector("#doublesTableBody");

const distinct = (value, index, self) =>
{
    return self.indexOf(value) === index;
};

document.addEventListener("DOMContentLoaded", event => {
    
    const db = firebase.firestore();
    const pageInformation = db.collection('information').doc('pageInformation');
    // below is a continous stream
    pageInformation.onSnapshot(doc => {
        var data = doc.data();
        var connectionStatus = document.querySelector("#connectionStatus");
        var mainTitle = document.querySelector('#mainTitle');
        mainTitle.textContent = data.title;
        connectionStatus.textContent = data.connectionStatus;
        connectionStatus.classList.add("connectionSuccess");
    });

    // waits for changes in the database and updates table if any change happens
    // will update any changes in real time
    db.collection("Players").orderBy("points", "desc").onSnapshot(doc =>{
        loadTableWithDocument(doc, mainTable);
    });

    db.collection("GameRequests").orderBy("timeStamp", "desc").onSnapshot(doc =>{
        updatePreviousGameTable(doc,true);
    });

    db.collection("GameRequestsDoubles").orderBy("timeStamp", "desc").onSnapshot(doc =>{
        updatePreviousGameTable(doc,false);
    });
});

// login form, just asks for password
const loginForm = document.querySelector("#loginForm");

loginForm.addEventListener('submit', (e) =>{
    e.preventDefault();

    // note that this just asks for a password as the email is provided below,
    // !the email and password combination will have to be set up in firebase!
    firebase.auth().signInWithEmailAndPassword('loginuser@eloladder.com', loginForm.password.value).catch(function(error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        console.log("Code: " + errorCode + " Message: " + errorMessage);
    }).then(e =>{
        //reload page
        location.reload();
    });

    loginForm.password.value = '';
});

//Add player form to add new players
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
            console.log("Attempting to add player " + name)
            firebase.firestore().collection("PlayerAddRequests").add({
                name:name
            });
        }
    }).then((e)=>{
        addPlayerForm.name.value = '';
    });
});

// buttons to switch between singles and doubles
const singlesButton = document.querySelector("#singles");
const doublesButton = document.querySelector("#doubles");

singlesButton.addEventListener("click", (e) =>{
    e.preventDefault();
    changeDoubles(false);
});
doublesButton.addEventListener("click", (e) =>{
    e.preventDefault();
    changeDoubles(true);
});

function changeDoubles(activateDoubles)
{
    doubles = activateDoubles;
    firebase.firestore().collection("Players").orderBy("points", "desc").get().then(doc =>{
        loadTableWithDocument(doc, mainTable);
    });
    const controlArea = document.querySelector('#controlArea');
    controlArea.textContent = doubles ? "Doubles" : "Singles";
}

// function to check if a game is valid, how many points will be exchanged
// also exchanges points and updates players
// although this function prechecks if a game is valid, this will be double checked on the cloud functions
function checkGame(winner, loser){
    if((winner != undefined) && (loser != undefined) && (winner != loser) && confirm("Did " + winner + " defeat " + loser + "?"))
    {
        var db = firebase.firestore();
        var players = db.collection("Players");
        var gameInfo = db.collection("information").doc("gameInformation");
        var winningPlayer1 = players.doc(winner);
        var losingPlayer1 = players.doc(loser);
        //points of winning and losing player

        //last opponents of winner/loser
        var winnerLastOpponent = '';
        var loserLastOpponent = '';

        // get results from the database and wait for them to return promises
        const promises = [];

        //get winning player points
        promises.push(winningPlayer1.get().then(doc => {
            if(doc.exists){
                winningPoints1 = doc.data().points;
                winningWins1 = doc.data().wins + 1;
                winnerLastOpponent = doc.data().lastOpponent;
                winnerStreak = doc.data().currentStreak;
                winnerMaxStreak = doc.data().maxStreak;
            }
        }));

        //get losing player points
        promises.push(losingPlayer1.get().then(doc => {
            if(doc.exists){
                losingPoints1 = doc.data().points;
                losingLosses1 = doc.data().losses + 1;
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
            // if it is invalid we return here, should a player manage to get past this,
            // google functions will check for this again
            if(loserLastOpponent == winner || winnerLastOpponent == loser)
            {
                alert('Each player has to play at least someone else, before playing again');
                return;
            }

            // Send gamerequest to database
            // calculation of scores will happen in google functions
            db.collection("GameRequests").add({
                winner: winner,
                loser: loser
            });
        });
        return true;
    }
    return false;
}

// same as checkGame except for doubles
function checkGameDoubles(winners, losers)
{
    // make sure last two players are in array
    while(winners.length > 2)
    {
        winners.shift();
    }

    while(losers.length > 2)
    {
        losers.shift();
    }

    console.log(losers);
    console.log(winners);

    var allPlayers = [];
    allPlayers.push(...winners);
    allPlayers.push(...losers);
    if(new Set(allPlayers).size !== 4 || winners.length !== 2 || losers.length !== 2)
    {
        console.log("illegal game-setup");
        return false;
    }

    if(confirm("Did " + winners[0] + " & "+ winners[1] + " defeat " + losers[0] + " & " + losers[1] + "?"))
    {
        var db = firebase.firestore();
        db.collection("GameRequestsDoubles").add({
            winner1: winners.pop(),
            winner2: winners.pop(),
            loser1: losers.pop(),
            loser2: losers.pop(),
        });
        return true;
    }
    return false;
}

// function will fill the main table with data from database
function loadTableWithDocument(doc, mainTable)
{
    while(mainTable.firstChild)
    {
        mainTable.removeChild(mainTable.firstChild);
    }
    var counter = 1;
    doc.forEach(function(entry)
    {
        if(!entry.data().frozen)
        {
            // add table row for each player
            let row = document.createElement('tr');
            let head = document.createElement('th');
            let name = document.createElement('td');

            // create point display for player
            let points = document.createElement('td');
            let pointsFull = document.createElement('span');
            let pointChange = document.createElement('span');
            let decayChange = document.createElement('span');

            let wins = document.createElement('td');
            let losses = document.createElement('td');
            let streak = document.createElement('td');
            let lastOpponent = document.createElement('td');

            let control = document.createElement('td');
            let prevRank = document.createElement('td');
            let winButton = document.createElement('button');
            let loseButton = document.createElement('button');

            row.classList.add('d-flex', 'flex-row')
            // //create width definition here:
            head.classList.add('col-1');
            name.classList.add('col-3', 'col-sm-2');

            // set up point display
            points.classList.add('col-2', 'col-sm-1');
            if(entry.data().lastResult)
            {
                pointChange.classList.add('lastGameWin', 'small');
                pointChange.textContent = "(+"+entry.data().pointGain+")";
            }
            else
            {
                pointChange.classList.add('lastGameLoss', 'small');
                pointChange.textContent = "("+entry.data().pointGain+")";
            }

            pointsFull.textContent = entry.data().points + " ";
            if(entry.data().currentDecay >= 0)
            {
                decayChange.textContent = " (+"+entry.data().currentDecay+")";
            }
            else
            {
                decayChange.textContent = " ("+entry.data().currentDecay+")";
            }
            decayChange.classList.add('decayDisplay', 'small');

            wins.classList.add('col-sm-1');
            losses.classList.add('col-sm-1');
            streak.classList.add('col-md-1');
            lastOpponent.classList.add('col-sm-2', 'col-xl-1');
            prevRank.classList.add('col-2', 'col-sm-1');
            control.classList.add('col-4', 'col-sm-3', 'col-md-2'); //'col-md-3', 'col-xl-2', 'd-flex', 'flex-row');
            //control.classList.add('debug');


            // set up logic for win- and losebuttons
            winButton.classList.add('btn', 'btn-success', 'btn-sm', 'w-50');
            winButton.textContent = "Won";
            winButton.addEventListener('click', function(){
                addGameParticipant(entry.data().name, true);
            });
            loseButton.classList.add('btn', 'btn-danger', 'btn-sm', 'w-50');
            loseButton.textContent = "Lost";
            loseButton.addEventListener('click', function(){
                addGameParticipant(entry.data().name, false);
            });
            control.appendChild(winButton);
            control.appendChild(loseButton);

            head.textContent = counter++;
            name.textContent = entry.data().name;

            points.appendChild(pointsFull);
            points.appendChild(pointChange);
            points.appendChild(decayChange);

            wins.textContent = entry.data().wins;
            losses.textContent = entry.data().losses;
            streak.textContent = entry.data().currentStreak;
            lastOpponent.textContent = entry.data().lastOpponent;
            prevRank.textContent = entry.data().prevRank;

            if(entry.data().isChampion)
            {
                name.classList.add('champion');
            }

            wins.classList.add('d-none', 'd-sm-table-cell');
            losses.classList.add('d-none', 'd-sm-table-cell');
            streak.classList.add('d-none', 'd-md-table-cell');
            lastOpponent.classList.add('d-none', 'd-sm-table-cell');

            row.appendChild(head);
            row.appendChild(name);
            row.appendChild(points);
            row.appendChild(wins);
            row.appendChild(losses);
            row.appendChild(streak);
            row.appendChild(lastOpponent);
            row.appendChild(prevRank);
            row.appendChild(control);

            mainTable.appendChild(row);
        }
        
    });
}

// function to add a game participant to a game
// will be called when a button is clicked
function addGameParticipant(player, won)
{
    if(won)
    {
        currentWinners.push(player);
    }
    else
    {
        currentLosers.push(player);
    }

    if(doubles)
    {
        if(checkGameDoubles(currentWinners, currentLosers))
        {
            currentWinners.splice(0, currentWinners.length);
            currentLosers.splice(0, currentLosers.length);
        }
    }
    else
    {
        if(checkGame(currentWinners[currentWinners.length -1], currentLosers[currentLosers.length-1]))
        {
            currentWinners.splice(0, currentWinners.length);
            currentLosers.splice(0, currentLosers.length);
        }
    }
}

// updates the tables showing previous games
function updatePreviousGameTable(doc, single)
{
    var table = null
    if(single)
    {
        table = singlesTable;
    }
    else
    {
        table = doublesTable;
    }
    var counter = 0;

    while(table.firstChild)
    {
        table.removeChild(table.firstChild);
    }

    doc.forEach(function(entry)
    {
        if(counter++ > 9)
        {
            return;
        }
        let row = document.createElement('tr');
        let dateField = document.createElement('td');
        let winner = document.createElement('td');
        let loser = document.createElement('td');
        let probability = document.createElement('td');
        let exchange = document.createElement('td');
        let date = new Date(entry.data().timeStamp);

        dateField.textContent = date.toUTCString();

        if(single)
        {
            winner.textContent = entry.data().winner;
            loser.textContent = entry.data().loser;
            probability.textContent = Number(entry.data().winnerExpectations).toFixed(2);
            exchange.textContent = entry.data().winnerGain;
        }
        else
        {
            winner.textContent = entry.data().winner1 + " & " + entry.data().winner2;
            loser.textContent = entry.data().loser1 + " & " + entry.data().loser2;
            probability.textContent = Number(entry.data().winnerTeamExpectations).toFixed(2);
            exchange.textContent = entry.data().winner1Gains + entry.data().winner2Gains;
        }

        row.classList.add('d-flex');
        dateField.classList.add('d-none', 'd-lg-table-cell', 'w-25', 'flex-shrink-1');
        winner.classList.add('w-25', 'font-weight-bold', 'flex-shrink-1');
        loser.classList.add('w-25', 'font-weight-bold', 'flex-shrink-1');
        probability.classList.add('w-25', 'flex-shrink-1');
        exchange.classList.add('d-none', 'd-lg-table-cell', 'w-25', 'flex-shrink-1');

        if(Number(probability.textContent) >= 0.5)
        {
            probability.classList.add('lastGameWin');
        }
        else
        {
            probability.classList.add('lastGameLoss');
        }

        row.appendChild(dateField);
        row.appendChild(winner);
        row.appendChild(loser);
        row.appendChild(probability);
        row.appendChild(exchange);

        table.appendChild(row);
    });
}