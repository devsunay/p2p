

const userName = "meow-"+Math.floor(Math.random()*100000)
const password = "x";

document.querySelector("#user-name").innerHTML = userName;

const socket = io.connect('https://192.168.85.7:8181',
    {
        auth:{
        userName,
        password
    }
})

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream; //a var to hold the local video stream
let remoteStream; //a var to hold the remote video stream
let peerConnection; //the peerConnection that the two clients use to talk
let didIOffer = false;

let peerConfiguration = {
    iceServers:[
        {
            urls:[
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}

const call = async (e) => {

    const stream = await navigator.mediaDevices.getUserMedia({
        video:true,
        audio:false
    })

    localVideoEl.srcObject = stream;
    localStream = stream;

    await createPeerConnection();

    try{
     console.log("creating Offer!!!!")
     const offer = await peerConnection.createOffer()
     console.log("created offer :-",offer)
    await peerConnection.setLocalDescription(offer);
    console.log("local description is set")
     didIOffer = true;
    
     socket.emit('newOffer',offer); //send offer to signalingServer
      console.log("sent offer to server")
    }catch(error){
        console.log(error);
    }
}

const answerOffer = async (offerObj)=>{
    didIOffer = false;
     const stream = await navigator.mediaDevices.getUserMedia({
        video:true,
        audio:false
    })

    localVideoEl.srcObject = stream;
    localStream = stream;

    await createPeerConnection(offerObj)
    const answer = await peerConnection.createAnswer({})

    await peerConnection.setLocalDescription(answer);
    
    console.log(offerObj)
    console.log("creating answer!!!")
     console.log(answer)

    offerObj.answer = answer;
    //emit the answer to the signaling server, so it can emit to CLIENT1
    //expect a response from the server with the already existing ICE candidates
   const offerIceCandidates = await socket.emitWithAck('newAnswer',offerObj)
   console.log("signaling status :-",peerConnection.signalingState)
   offerIceCandidates.forEach(c => {
    peerConnection.addIceCandidate(c)
    console.log("added ice candidate")
   })
   console.log(offerIceCandidates)
}

const addAnswer = async(offerObj)=> {
    await peerConnection.setRemoteDescription(offerObj.answer)
    console.log("remote description is set")
    console.log("signaling status :-",peerConnection.signalingState)
}

const createPeerConnection = async (offerObj)=>{
      
    peerConnection = await new RTCPeerConnection(peerConfiguration)
    remoteStream = new MediaStream()
    remoteVideoEl.srcObject = remoteStream;

    localStream.getTracks().forEach(track => {
    //add localtracks so that they can be sent once the connection is established
    peerConnection.addTrack(track,localStream);
    })
    console.log("added local tracks to peer connection")

    peerConnection.addEventListener("signalingstatechange",event => {
        console.log(event);
        
        console.log("signaling status :-",peerConnection.signalingState)
    })

    peerConnection.addEventListener("icecandidate",e => {
         console.log('........Ice candidate found!......')
         console.log(e)

         if(e.candidate){
            socket.emit("sendIceCandidateToSignalingServer",{
                iceCandidate: e.candidate,
                iceUserName: userName,
                didIOffer,
            })
            console.log("sent ice candidate to the server")
         }
    })

     peerConnection.addEventListener('track',e=>{
            console.log("Got a track from the other peer!! How excting")
            console.log(e)
            e.streams[0].getTracks().forEach(track=>{
                remoteStream.addTrack(track,remoteStream);
                console.log("Here's an exciting moment... fingers cross")
            })
        })

        if(offerObj){
            //this won't be set when called from call();
            //will be set when we call from answerOffer()
            console.log("recieved answer from client 2")
            console.log("signaling status :-",peerConnection.signalingState) //should be stable because no setDesc has been run yet
            await peerConnection.setRemoteDescription(offerObj.offer)
            console.log("remote description is set")
            console.log("signaling status :-",peerConnection.signalingState) //should be have-remote-offer, because client2 has setRemoteDesc on the offer
        }
}

const addNewIceCandidate = async (candidate)=>{
    peerConnection.addIceCandidate(candidate);
    console.log("ice candidate added")
}

document.querySelector('#call').addEventListener('click',call)