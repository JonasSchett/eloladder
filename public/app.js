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
    db.collection("Players").orderBy("points", "desc").onSnapshot(doc =>{
        while(mainTable.firstChild){
            mainTable.removeChild(mainTable.firstChild);
        }
        var counter = 1;
        doc.forEach(function(entry){
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
    firebase.firestore().collection("Players").doc(addPlayerForm.name.value).set({
        name: addPlayerForm.name.value,
        points: 1500,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        maxStreak: 0,
    })
    .then(function() {
        console.log("Document successfully written!");
    })
    .catch(function(error) {
        console.error("Error writing document: ", error);
    });

    addPlayerForm.name.value = '';
});

const loginForm = document.querySelector("#loginForm");

loginForm.addEventListener('submit', (e) =>{
    e.preventDefault();
    firebase.auth().signInWithEmailAndPassword('loginuser@tablefootball.com', loginForm.password.value).catch(function(error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
    });
    loginForm.password.value = '';
});

function checkGame(winner, loser){
    if((winner != loser) && (winner != '') && (loser != '') && confirm("did " + winner + " defeat " + loser + "?")){
        var db = firebase.firestore();
        var players = db.collection("Players");
        var winningPlayer = players.doc(winner);
        var losingPlayer = players.doc(loser);
        var winningPoints = 0;
        var losingPoints = 0;

        // get results from the database and wait for them to return promises.
        const promises = [];
        //get winning player points
        promises.push(winningPlayer.get().then(doc => {
            if(doc.exists){
                winningPoints = doc.data().points;
            }
        }));
        //get losing player points
        promises.push(losingPlayer.get().then(doc => {
            if(doc.exists){
                losingPoints = doc.data().points;
            }
        }));

        // after all promises have been received we can continue with the
        // actual calculation of the program
        Promise.all(promises).then((e) => {
            // calculate new elo
            //get Elo parameters
            const n = 400;
            const k = 80;
            const x  = winningPoints - losingPoints;
            const exponent = -(x/n);
            const winnerExpected = 1/(1+Math.pow(10,exponent));
            const loserExpected = 1-winnerExpected;
            winningPoints = Math.round(winningPoints + k * (1-winnerExpected));
            losingPoints = Math.round(losingPoints + k * (0-loserExpected));

            winningPlayer.update({
                points: winningPoints
            })
            losingPlayer.update({
                points: losingPoints
            })
        });
        return true;
    }
    return false;
}