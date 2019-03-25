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

function googleLogin(){
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).then(result =>{
        const user = result.user;
        var dName = user.displayName;
        document.write("Hello " + dName);
        console.log(user);
    }).catch(console.log)
}