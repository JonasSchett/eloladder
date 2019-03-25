document.addEventListener("DOMContentLoaded", event => {
    const app = firebase.app();
    console.log(app);
});

alert("Hello");

function googleLogin()
{
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).then(result => {
        const user = result.user;
        document.write("Hello ${user.displayName}");
        console.log
    }).catch(console.log);

}