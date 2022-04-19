const { application } = require('express');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

let totalPoints = 0;
let payerPoints = {};
let pointTransactions = [];

router.get('/', (req, res) => {
    res.send(payerPoints)
});

router.post('/', [
    body('payer').isString().toUpperCase(),
    body('points').isInt().toInt(),
    body('timestamp').isISO8601(),
    body().custom(body => {
        let keys = ['payer', 'points', 'timestamp'];
        return Object.keys(body).every(key => keys.includes(key));
        // error message if extra parameters are sent in body of request
      }).withMessage('Extra parameters were sent. Params restricted to: payer:<str>, points:<int>, timestamp:<ISO8601>')
    ],
    (req, res, next) => {
        let errors = validationResult(req);
        // return error if body of request does not pass validation constraints
        if(!errors.isEmpty()) return res.status(422).send(errors.array({ onlyFirstError: true}))
        next();
    }, (req, res) => {
        let payer = req.body.payer;
        let points = req.body.points;
        // return error if trying to add 0 points
        if (points == 0) {
          return res.status(422).json({ error: "Unable to add transaction", reason: "Points must be a positive or negative integer"});
        };
        // return error if transaction would cause payer's points to go negative, else add points to payerPoints dictionary
        if ((!payerPoints[payer] && points < 0) || ((payerPoints[payer] + points) < 0)) {
          return res.status(422).json({ error: "Unable to add transaction", reason: `Payer balance can't go negative. ${payer} has ${!payerPoints[payer] ? 0 : payerPoints[payer]} points in account` });
        } else if (!payerPoints[payer]) {
          payerPoints[payer] = points
        } else {
          payerPoints[payer] += points
        };

        // add points to total
    totalPoints += points
    // if adding negative number of points, subtract from most recent payer transactions
    if (points < 0) {
      let absPoints = Math.abs(points);
      // array to store indexes of used up transactions
      let removeIndex = [];
      let counter = pointTransactions.length - 1;
      while (absPoints > 0) {
        let transPayer = pointTransactions[counter]['payer'];
        let transPoints = pointTransactions[counter]['points'];
        if (transPayer === payer) {
          if (transPoints === absPoints) {
            absPoints = 0
            removeIndex.push(counter)
          } else if (transPoints > absPoints) {
            pointTransactions[counter]['points'] -= absPoints
            absPoints = 0
          } else {
            removeIndex.push(counter)
            absPoints -= transPoints
          };
        };
        counter--
      };
      // remove transactions from list that are used up by addition of negative points
      for (i = 0;i < removeIndex.length; i++) {
        pointTransactions.splice(removeIndex[i],1);
      };
    };
    // if adding positive number of points, add transaction to list and sort list from oldest to newest
    if (points > 0) {
      pointTransactions.push(req.body);
      pointTransactions.sort(function(a, b) {
        return (a.timestamp < b.timestamp) ? -1 : ((a.timestamp > b.timestamp) ? 1 : 0);
      });
    };
    // send response if transaction added
    res.status(200).json({ success: "transaction added", transaction: req.body})
});


// POST route to spend points
router.post('/spend', [
  // validate & sanitize body of request
  body('points').isInt().toInt(),
  body().custom(body => {
    let keys = ['points'];
    return Object.keys(body).every(key => keys.includes(key));
    // error message if extra parameters are sent in body of request
  }).withMessage('Extra parameters were sent. Params restricted to: points:<int>')
], (req, res, next) => {
    let errors = validationResult(req);
    // return error if body of request does not pass validation constraints
    if(!errors.isEmpty()) return res.status(422).send(errors.array({ onlyFirstError: true}))
    next();
}, (req, res) => {
    let points = req.body.points
    // return error if trying to add 0 points
    if(points <= 0) {
      return res.status(422).json({ error: "Unable to spend points.", reason: "Points param must be positive integer above 0."})
    }
    // return error if trying to spend more points than available
    if(points > totalPoints) {
      return res.status(422).json({ error: "Unable to spend points.", reason: `${totalPoints} points available to spend.`})
    }
    // subtract points to total
    totalPoints -= points;
    // dictionary to keep track of how many points are spent from each payer
    let spent = {};
    // array to hold indexes of used up transactions
    let removeIndex = [];
    let counter = 0;
    while (points > 0) {
      let transPayer = pointTransactions[counter]['payer']
      let transPoints = pointTransactions[counter]['points']
      if (transPoints == points) {
        transPayer in spent ? spent[transPayer] += points : spent[transPayer] = points;
        payerPoints[transPayer] -= points
        points = 0
        removeIndex.push(counter)
      } else if (transPoints > points) {
        transPayer in spent ? spent[transPayer] += points : spent[transPayer] = points;
        pointTransactions[counter]['points'] -= points
        payerPoints[transPayer] -= points
        points = 0
      } else {
        spent[transPayer] = transPoints;
        points -= transPoints
        payerPoints[transPayer] -= transPoints
        removeIndex.push(counter)
      }
      counter++
    }
    // remove transactions from list that are used up by spending points
    for (let i = removeIndex.length - 1; i >= 0; i--) {
      pointTransactions.splice(removeIndex[i],1);
    };

    let spentList = [];
    for (const payer in spent) {
      spentList.push({ "payer": payer, "points": spent[payer]*-1})
    }
    // send response if points spent
    res.status(200).send(spentList)
});

module.exports = router;