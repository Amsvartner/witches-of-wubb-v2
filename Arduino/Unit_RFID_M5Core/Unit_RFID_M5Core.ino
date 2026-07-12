/*
*******************************************************************************
* Copyright (c) 2021 by M5Stack
*                  Equipped with M5Core sample source code
*                          配套  M5Core 示例源代码
* Visit for more information: https://docs.m5stack.com/en/unit/uhf_rfid
* 获取更多资料请访问: https://docs.m5stack.com/zh_CN/unit/uhf_rfid
*
* Product: UHF RFID UNIT
* Date: 2022/7/8
*******************************************************************************/
// enable for debug mode, adds osc messages
#define DEBUG 0

#include <WiFi.h>
#include <OSCMessage.h>
#include <WiFiUdp.h>
#include "UNIT_UHF_RFID.h"
#include "secrets.h"

// Set up the Wi-Fi client
WiFiClient client;

// Set up the UDP connection
WiFiUDP udp;

// Setup RFID Reader
// Make sure to modify the waitMsg Timeout to be 50
Unit_UHF_RFID uhf;

// Networking constants
// const char *ssid = "TP-Link_E262";
// const char *password = "13921255";

//const char *ssid = "Haleakala IoT";
//const char *password = "amends nova skirt voiced";

const char *ssid = "wubb-net";
const char *password = "audioshitstorm";

// const char *ssid = "WirelessB";
// const char *password = "greasy@pizza";

// This device's pillar identity — set PILLAR_IP in secrets.h (WOW-030), not
// here. See docs/HARDWARE_INTEGRATION.md for the full pillar<->IP table.
IPAddress ip = PILLAR_IP;

const char *broadcastAddress = "255.255.255.255";  // Use broadcast address to send OSC message to all devices on the local network
const int remotePort = 9000;                       // Set the port number of the OSC receiver

//RFID Configs 
// max: 26dB 2600
const int RFID_TX_PWR = 100; //500

//function delay
const int FUNC_DELAY = 10;
const int MULTI_POLL = 5;

// variables for the removal detection
int _rfid_error_counterArr[2] = { 0, 0 };
int _rfid_error_threshold = 2; // 6

// object states
String currentCard = "";
String succesorCard = "";
String contenderCard = "";

int loop_no = 0;

// uint8_t write_buffer[] = { 0xab, 0xcd, 0xef, 0xdd };
// uint8_t reade_buffer[4] = { 0 };

bool currentCardCheck(uint8_t result, CARD cards[200], String cardToCheck, int cardNum) {

  // Serial.println("CurrentCard being checked: " + cardToCheck); //NOISE

  // Does our card exist in the Stack?
  for (uint8_t i = 0; i < result; i++) {
    if (cardToCheck == cards[i].epc_str) {
      // Serial.println("Found the same card");
      _rfid_error_counterArr[cardNum] = 0;
      return true;
    }
  }
  
  // increase our error counter
  _rfid_error_counterArr[cardNum] += 1;

  // Serial.printf("Current Err Counter: %d\n", _rfid_error_counterArr[cardNum]); //NOISE

  // check to see if we are within our threshold of misses
  if (_rfid_error_counterArr[cardNum] > _rfid_error_threshold) {
    return false;
  } else {
    // card not detected, but below error threshold; Continue on...
    return true;
  }
  
}

String determineSuccesor(uint8_t result, CARD cards[200], String currentCard) {
  // We have multiple cards
  if (result > 1) {

    // Check through the stack of cards
    for (uint8_t i = 0; i < result; i++) {

      // Found a successor
      if (currentCard != cards[i].epc_str) {
        return cards[i].epc_str;
      }
    }
    return "";
  } else {
    return "";
  }
}

// Mirrors (read-only, does not reference) the frozen pillar<->IP map in
// backend/event/IncomingEvents.ts, purely so the boot log below can name
// this device's pillar. The backend's map is the only one that actually
// governs tag routing — this is a diagnostic convenience, nothing more.
int pillarNumberForIp(IPAddress candidateIp) {
  if (candidateIp[0] == 192 && candidateIp[1] == 168 && candidateIp[2] == 0) {
    int lastOctet = candidateIp[3];
    if (lastOctet >= 101 && lastOctet <= 104) {
      return lastOctet - 101;
    }
  }
  return -1;
}

void printPillarIdentity() {
  Serial.print("Configured IP: ");
  Serial.println(ip);
  int pillar = pillarNumberForIp(ip);
  if (pillar >= 0) {
    // 0-3, matching backend/event/IncomingEvents.ts's own pillar index --
    // NOT the 1-4 numbering used in outgoing OSC addresses/UI-facing logs.
    Serial.print("Derived pillar index (0-3, code convention): ");
    Serial.println(pillar);
  } else {
    Serial.println(
      "Derived pillar index: UNKNOWN -- this IP is not in the frozen 192.168.0.101-104 "
      "pillar range (see docs/HARDWARE_INTEGRATION.md). The backend will silently "
      "drop this device's tag events. Check PILLAR_IP in secrets.h.");
  }
}

void setup() {

  Serial.begin(115200);
  uhf.begin(&Serial2, 115200, 17, 16, DEBUG);

  printPillarIdentity();

  Serial.println("Connecting to Wi-Fi network...");

  // Connect to Wi-Fi network
  WiFi.config(ip);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(1000);
  }

  Serial.println("Connected to Wi-Fi network");

  // Begin UDP connection
  udp.begin(WiFi.localIP(), remotePort);

  while (1) {
    if (uhf.getVersion() != "ERROR") {
      Serial.println(uhf.getVersion());
      //Serial.println(uhf.selectInfo());
      break;
    }
    Serial.println(uhf.getVersion());
  }

  uhf.setTxPower(RFID_TX_PWR);

  // Print a message to indicate that the setup is complete
  Serial.println("RFID sensor ready!");

  // Create a new OSC message
  OSCMessage msg("/bootup/device");

    // add the string to the osc message
  // must be sent over
  msg.add("bootup-sound.mp3");

  // Send the OSC message over UDP to the broadcast address and port number
  udp.beginPacket(broadcastAddress, remotePort);
  msg.send(udp);
  udp.endPacket();

  // Clear the OSC message
  msg.empty();
}

void loop() {

  // Polling the RFID Reader.... ONCE!
  //  uint8_t result = uhf.pollingOnce();
  uint8_t result = uhf.pollingMultiple(MULTI_POLL);
  // Serial.printf("Results: %d\n", result); //NOISE
  // Serial.printf("Current Err Counter: %d\n", _rfid_error_counterArr[0]); //NOISE

  // We found Cards!
  if (result > 0) {

    // Serial.println("RSSI " + uhf.cards[0].epc_str + " " + uhf.cards[0].rssi_str);

    //Is there a card currently set?
    if (currentCard == "") {

      // Setting initial card
      currentCard = uhf.cards[0].epc_str;
      Serial.println("Tag found");
      Serial.println("New Tag: " + currentCard);

      //OSC Msg New Card
      OSCMessage msg("/new/tag");
      // add the string to the osc message must be sent over
      msg.add(currentCard.c_str());

      // Send the OSC message over UDP to the broadcast address and port number
      udp.beginPacket(broadcastAddress, remotePort);
      msg.send(udp);
      udp.endPacket();

      // Clear the OSC message
      msg.empty();
      delay(5);

    } else {

      // Is the current card still here?
      if (currentCardCheck(result, uhf.cards, currentCard, 0)) {

        // let grab the successor if available
        contenderCard = determineSuccesor(result, uhf.cards, currentCard);

        // We don't have a succesor
        if (succesorCard == "" && contenderCard != "") {
          succesorCard = contenderCard;
          Serial.println("New succesorCard: " + succesorCard);
          // Resetting Counters
          _rfid_error_counterArr[1] = 0;
        } else {
          // Succesor is set, but we have a contender
          if (succesorCard != contenderCard && contenderCard != "") {
            // Checking to see if we are in tollerance
            if (!currentCardCheck(result, uhf.cards, succesorCard, 1)) {
              succesorCard = contenderCard;
              // Resetting Counters
              _rfid_error_counterArr[1] = 0;
              Serial.println("Contender Promoted: " + succesorCard);
            }
          } else {
            // current contender must be the current successor (or maybe be null)
          }
        }
        // Serial.println("Succesor Check: " + succesorCard); //NOISE
      } else {
        // Our current card has left!!! But we're still reading cards, time to promote the successor, if we can.
        Serial.println("Departed Tag: " + currentCard);
        Serial.println("Current Succesor Set: " + succesorCard);

        // OSC MSG Depart
        OSCMessage msg("/departed/tag");
        // add the string to the osc message must be sent over
        msg.add(currentCard.c_str());

        // Send the OSC message over UDP to the broadcast address and port number
        udp.beginPacket(broadcastAddress, remotePort);
        msg.send(udp);
        udp.endPacket();

        // Clear the OSC message
        msg.empty();
        delay(5);

        // Promoting Succesor
        if (succesorCard != "") {
          
          currentCard = succesorCard;
          succesorCard = "";

          Serial.println("Card Succesor Promoted: " + currentCard);

          Serial.println("New Tag: " + currentCard);
          
          //OSC Msg New Card
          OSCMessage msg("/new/tag");
          // add the string to the osc message must be sent over
          msg.add(currentCard.c_str());

          // Send the OSC message over UDP to the broadcast address and port number
          udp.beginPacket(broadcastAddress, remotePort);
          msg.send(udp);
          udp.endPacket();

          // Clear the OSC message
          msg.empty();
          delay(5);
        } else {
          currentCard = uhf.cards[0].epc_str;
          Serial.println("Setting currentCard to " + currentCard);

          //OSC Msg New Card
          OSCMessage msg("/new/tag");
          // add the string to the osc message must be sent over
          msg.add(currentCard.c_str());

          // Send the OSC message over UDP to the broadcast address and port number
          udp.beginPacket(broadcastAddress, remotePort);
          msg.send(udp);
          udp.endPacket();

          // Clear the OSC message
          msg.empty();
          delay(5);
        }

        // Resetting Counters
        _rfid_error_counterArr[0] = 0;
      }
    }
    // Wait for 200 milliseconds before sending the next OSC message
    delay(FUNC_DELAY);
  } else {
    if (currentCard != "") {
      // No Cards being Read
      // Is the current card missing within toleranec?
      if (!currentCardCheck(result, uhf.cards, currentCard, 0)) {

        // Our current card has left and there are no other cards being read!!!
        Serial.println("Departed Tag: " + currentCard);

        // OSC MSG Depart
        OSCMessage msg("/departed/tag");
        // add the string to the osc message must be sent over
        msg.add(currentCard.c_str());

        // Send the OSC message over UDP to the broadcast address and port number
        udp.beginPacket(broadcastAddress, remotePort);
        msg.send(udp);
        udp.endPacket();

        // Clear the OSC message
        msg.empty();
        delay(5);

        // Reset Buffer and Err Counter for next new tag
        _rfid_error_counterArr[0] = 0;
        _rfid_error_counterArr[1] = 0;
        currentCard = "";
        succesorCard ="";

        Serial.println("Card Buffer Cleared");
      }
    }
  }
  delay(FUNC_DELAY);
}
