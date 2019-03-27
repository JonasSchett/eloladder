document.addEventListener("DOMContentLoaded", event => {
    const app = firebase.app();
    console.log(app);

    const db = firebase.firestore();
    const info = db.collection('Players').doc('test');
    // below is a continous stream
    info.onSnapshot(doc => {
        const data = doc.data();
        var a = document.querySelector(".databaseRetrieval");
        a.textContent = data.title;
    });
    // below gets it once
    // info.get().then(doc => {
    //     const data = doc.data();
    //     var a = document.querySelector(".databaseRetrieval");
    //     a.textContent = data.title;
    // });


});

const form = document.querySelector("#addPlayerForm")

form.addEventListener('submit', (e) =>{
    e.preventDefault();
    firebase.firestore().collection("Players").doc(form.name.value).set({
        name: form.name.value,
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

    form.name.value = '';
});

function googleLogin(){
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).then(result =>{
        
        const user = result.user;
        console.log(user.displayName);
    }).catch(console.log)
}

function passwordLogin(){
    var password = prompt("Enter the password:");
    firebase.auth().signInWithEmailAndPassword('loginuser@tablefootball.com', password).catch(function(error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
    });
}

function addData(){

}