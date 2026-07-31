/*
This example will receive multiple universes via Art-Net and control a strip of
WS2812 LEDs via the FastLED library: https://github.com/FastLED/FastLED
This example may be copied under the terms of the MIT license, see the LICENSE file for details
*/
#include <ArtnetWifi.h>
#include <Arduino.h>
#include <FastLED.h>
#include "secrets.h"

// Wifi settings — real values live in secrets.h (gitignored).
// Copy secrets.h.example to secrets.h and fill in the real network credentials.
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// UPDATE ME!!!
IPAddress ip(192, 168, 0, 65);

// LED settings
const int numLeds = 144; // CHANGE FOR YOUR SETUP
const int numberOfChannels = numLeds * 3; // Total number of channels you want to receive (1 led = 3 channels)
const byte dataPin = 2;
CRGB leds[numLeds];

// Art-Net settings
ArtnetWifi artnet;
const int startUniverse = 0; // CHANGE FOR YOUR SETUP most software this is 1, some software send out artnet first universe as 0.

// Check if we got all universes
const int maxUniverses = numberOfChannels / 510 + ((numberOfChannels % 510) ? 1 : 0);
bool universesReceived[maxUniverses];
bool sendFrame = 1;

// Wi-Fi reconnect state (WOW-029). loop() monitors WiFi.status() and retries
// with backoff instead of freezing forever after the first drop. This is the
// safe half of WOW-029's fix: reconnection logic only, zero LED behavior
// change. What the LEDs should visibly show during an outage is a show-design
// decision - see docs/DECISIONS_NEEDED.md ("Hardware / firmware") - until
// that's answered, the strip simply keeps whatever frame Art-Net last set.
bool wifiWasConnected = true;
unsigned long lastWifiRetryMs = 0;
unsigned long wifiRetryIntervalMs = 1000; // starts at 1s, backs off on repeated failure
const unsigned long WIFI_RETRY_INTERVAL_MAX_MS = 30000; // cap at 30s so a long outage doesn't spam WiFi.begin()


// connect to wifi – returns true if successful or false if not
bool ConnectWifi(void)
{
  bool state = true;
  int i = 0;

  WiFi.config(ip);
  WiFi.begin(ssid, password);
  Serial.println("");
  Serial.println("Connecting to WiFi");

  // Wait for connection
  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
    if (i > 20)
    {
      state = false;
      break;
    }
    i++;
  }
  if (state)
  {
    Serial.println("");
    Serial.print("Connected to ");
    Serial.println(ssid);
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  }
  else
  {
    Serial.println("");
    Serial.println("Connection failed.");
  }

  return state;
}

// Non-blocking reconnect attempt (WOW-029): called from loop() once already
// disconnected. Unlike ConnectWifi()'s blocking retry-loop (fine at boot,
// would freeze artnet.read() from ever running again if reused here), this
// only re-issues WiFi.begin() once wifiRetryIntervalMs has elapsed since the
// last attempt, backing off (capped) on each consecutive failure.
void attemptWifiReconnect()
{
  unsigned long now = millis();
  if (now - lastWifiRetryMs < wifiRetryIntervalMs)
  {
    return;
  }
  lastWifiRetryMs = now;

  Serial.println("Wi-Fi disconnected, attempting reconnect...");
  WiFi.disconnect();
  WiFi.config(ip);
  WiFi.begin(ssid, password);

  wifiRetryIntervalMs = min(wifiRetryIntervalMs * 2, WIFI_RETRY_INTERVAL_MAX_MS);
}

void initTest()
{
  for (int i = 0 ; i < numLeds ; i++)
  {
    leds[i] = CRGB(127, 0, 0);
  }
  FastLED.show();
  delay(500);
  for (int i = 0 ; i < numLeds ; i++)
  {
    leds[i] = CRGB(0, 127, 0);
  }
  FastLED.show();
  delay(500);
  for (int i = 0 ; i < numLeds ; i++)
  {
    leds[i] = CRGB(0, 0, 127);
  }
  FastLED.show();
  delay(500);
  for (int i = 0 ; i < numLeds ; i++)
  {
    leds[i] = CRGB(0, 0, 0);
  }
  FastLED.show();
}

void onDmxFrame(uint16_t universe, uint16_t length, uint8_t sequence, uint8_t* data)
{
  sendFrame = 1;
  // set brightness of the whole strip
  if (universe == 15)
  {
    FastLED.setBrightness(data[0]);
    FastLED.show();
  }

  // range check
  if (universe < startUniverse)
  {
    return;
  }
  uint8_t index = universe - startUniverse;
  if (index >= maxUniverses)
  {
    return;
  }

  // Store which universe has got in
  universesReceived[index] = true;

  for (int i = 0 ; i < maxUniverses ; i++)
  {
    if (!universesReceived[i])
    {
      sendFrame = 0;
      break;
    }
  }

  // read universe and put into the right part of the display buffer
  for (int i = 0; i < length / 3; i++)
  {
    int led = i + (index * 170);
    if (led < numLeds)
    {
      leds[led] = CRGB(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    }
  }

  if (sendFrame)
  {
    FastLED.show();
    // Reset universeReceived to 0
    memset(universesReceived, 0, maxUniverses);
  }
}

void setup()
{
  Serial.begin(115200,SERIAL_8N1, -1, -1, false, 1000);
  // WOW-029: ConnectWifi()'s return value used now (was previously
  // discarded) so a boot-time failure is at least visible in the serial
  // log, instead of silently proceeding with no network. No LED change
  // here - a visible boot-failure indicator is part of the same still-open
  // show-design decision as the mid-show fallback state (see the
  // attemptWifiReconnect() comment above and docs/DECISIONS_NEEDED.md).
  wifiWasConnected = ConnectWifi();
  if (!wifiWasConnected)
  {
    Serial.println("Booting without Wi-Fi connectivity - will keep retrying in the background once loop() starts.");
  }
  artnet.begin();
  FastLED.addLeds<WS2812, dataPin, GRB>(leds, numLeds);
  initTest();

  memset(universesReceived, 0, maxUniverses);
  // this will be called for each packet received
  artnet.setArtDmxCallback(onDmxFrame);
}

void loop()
{
  // WOW-029: track connection state and reconnect in the background instead
  // of never checking WiFi.status() again after setup(). No LED behavior
  // change - see attemptWifiReconnect()'s comment above.
  bool wifiConnected = (WiFi.status() == WL_CONNECTED);
  if (!wifiConnected)
  {
    if (wifiWasConnected)
    {
      Serial.println("Wi-Fi connection lost.");
    }
    attemptWifiReconnect();
  }
  else if (!wifiWasConnected)
  {
    Serial.println("Wi-Fi reconnected.");
    wifiRetryIntervalMs = 1000; // reset backoff for the next outage
  }
  wifiWasConnected = wifiConnected;

  // we call the read function inside the loop
  artnet.read();
}
