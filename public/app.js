document.addEventListener("DOMContentLoaded", event => {
    const app = firebase.app();
    console.log(app);
    const mainTable = document.querySelector("#mainTableBody");

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
            winButton.classList.add('btn', 'btn-success');
            winButton.textContent = "Won";
            looseButton.classList.add('btn', 'btn-danger');
            looseButton.textContent = "Lost";
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
});