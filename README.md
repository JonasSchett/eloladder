This project is based on using firebase. To see details on firebase please visit firebase.google.com


PREREQUESITS:
- Have a google account
- Have node.js installed on your device (https://nodejs.org/en/download/)
SETUP:
INstallation of firebase tools:
- Use npm to install firebase "npm install -g firebase-tools"

Creation of project:
- Go to firebase.google.com and hit "Get Started" and "Add project"
- Enter your desired project name and continue through the initial setup steps.
- You will need to enable firestore through the website
- Select "Database" on the left under the project overview and click on "create database"
- Select "Start in locked mode" to lock the database for any access for now and hit next
- Select the location you would like to use (the closer to you the better) and click done.

Setup of project locally:
- Go to the cloned repository and run "firebase login" and follow the login promts with your google account
- Run "firebase use --add" and select the project you just created. Name it's alias  "default" so it will be used for initialisation.
- Now run "firebase init" and hit enter when asked if you would like to proceed. This will install dependencies no part of git repo.
- Select "Firestore", "Functions" & "Hosting" with arrow keys and space bar, then hit enter.
- Selecte "Use an existing project" and hit enter
- Use the default settings in the coming questions, !!BUT use TYPESCRIPT instead of JAVASCRIPT when prompted!!
- The default settings will use settings set up in this project
- Finally, run "firebase deploy", this SHOULD update everythin on the webpage and update functions and rules for database access

Set up database and authentication:
- Go to your project on the firebase console
- Go to Authentication and click "Set up sign-in method"
- Enable Email/Password and go to Users
- Click Add user. Enter the user "loginuser@eloladder.com" and a password of your choice.
- You can replace the email used above by any value by going to app.js and changing it there, it is just so not everyone has to sign up using their own email and password and allows people to just log in using a password.
- Copy the user ID of the user you just created
- Go to Database and click "Start collection"
- Enter "users" for the Collection ID and click next
- Copy the user ID into the document ID field and click save.
- Create another collection named "Initialisation" and create a document with an automatic ID in it
- Wait for a bit and the database should be set up.

Hosting:
- After going through the previous steps, you can go to Hosting and click on the URL shown there.
- Login using the password you earlier used.

Database configuration:
- Open the information collection to change some default values
- To add players add a document to "PlayerAddRequests" with an Auto-ID, but add a field named "name" and give it a string value of the player name. This will add the player to the database. With some simple changes, this can be added to the website

Operating the page:
- To add games read the instructions on the website you just launched

