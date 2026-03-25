const nodemailer = require("nodemailer");

const EMAIL_COPY = {
  en: {
    welcomeSubject: "Congratulations and welcome to LPG Smart Assistant",
    loginSubject: "Congratulations, you signed in to LPG Smart Assistant",
    preferenceSubject: "Your LPG preference summary",
    preferenceUpdatedSubject: "Your LPG preferences were updated",
    welcomeGreeting: (name) => `Hello ${name},`,
    loginGreeting: (name) => `Hello ${name},`,
    preferenceGreeting: (name) => `Hello ${name},`,
    welcomeIntro: "Congratulations on joining LPG Smart Assistant.",
    loginIntro: "Congratulations, your sign-in to LPG Smart Assistant was successful.",
    preferenceIntro: "Here is a summary of your current LPG notification preferences.",
    preferenceUpdatedIntro: "Your LPG notification preferences were updated successfully.",
    periodicSubject: "LPG Update Notification",
    periodicGreeting: (name) => `Hello ${name},`,
    periodicIntro: "Here is your latest LPG availability update.",
    periodicStoresLabel: "Available Stores:",
    periodicRecommendationPrefix: "Best Recommendation:",
    periodicPredictionPrefix: "Prediction:",
    periodicFooter: ["Stay tuned for more LPG updates.", "", "- LPG Smart System"],
    smartSubject: "LPG Smart Alert",
    smartGreeting: (name) => `Hello ${name},`,
    smartIntro: "We spotted an important LPG update that matches your notification preferences.",
    smartFooter: ["Please check the app for the latest branch details.", "", "- LPG Smart System"]
  },
  hi: {
    welcomeSubject: "Congratulations and welcome to LPG Smart Assistant",
    loginSubject: "Congratulations, you signed in to LPG Smart Assistant",
    preferenceSubject: "Your LPG preference summary",
    preferenceUpdatedSubject: "Your LPG preferences were updated",
    welcomeGreeting: (name) => `Hello ${name},`,
    loginGreeting: (name) => `Hello ${name},`,
    preferenceGreeting: (name) => `Hello ${name},`,
    welcomeIntro: "Congratulations on joining LPG Smart Assistant.",
    loginIntro: "Congratulations, your sign-in to LPG Smart Assistant was successful.",
    preferenceIntro: "Here is a summary of your current LPG notification preferences.",
    preferenceUpdatedIntro: "Your LPG notification preferences were updated successfully.",
    periodicSubject: "LPG Update Notification",
    periodicGreeting: (name) => `Hello ${name},`,
    periodicIntro: "Here is your latest LPG availability update.",
    periodicStoresLabel: "Available Stores:",
    periodicRecommendationPrefix: "Best Recommendation:",
    periodicPredictionPrefix: "Prediction:",
    periodicFooter: ["Stay tuned for more LPG updates.", "", "- LPG Smart System"],
    smartSubject: "LPG Smart Alert",
    smartGreeting: (name) => `Hello ${name},`,
    smartIntro: "We spotted an important LPG update that matches your notification preferences.",
    smartFooter: ["Please check the app for the latest branch details.", "", "- LPG Smart System"]
  },
  te: {
    welcomeSubject: "LPG Smart Assistant కు స్వాగతం",
    loginSubject: "మీరు LPG Smart Assistant లో విజయవంతంగా లాగిన్ అయ్యారు",
    preferenceSubject: "మీ LPG ప్రాధాన్యతల సంగ్రహం",
    preferenceUpdatedSubject: "మీ LPG ప్రాధాన్యతలు నవీకరించబడ్డాయి",
    welcomeGreeting: (name) => `హలో ${name},`,
    loginGreeting: (name) => `హలో ${name},`,
    preferenceGreeting: (name) => `హలో ${name},`,
    welcomeIntro: "LPG Smart Assistant లో చేరినందుకు అభినందనలు.",
    loginIntro: "మీ లాగిన్ విజయవంతంగా పూర్తయింది.",
    preferenceIntro: "మీ ప్రస్తుత LPG నోటిఫికేషన్ ప్రాధాన్యతల సంగ్రహం ఇది.",
    preferenceUpdatedIntro: "మీ LPG నోటిఫికేషన్ ప్రాధాన్యతలు విజయవంతంగా నవీకరించబడ్డాయి.",
    periodicSubject: "LPG అప్డేట్ నోటిఫికేషన్",
    periodicGreeting: (name) => `హలో ${name},`,
    periodicIntro: "ఇది మీ తాజా LPG లభ్యత అప్డేట్.",
    periodicStoresLabel: "అందుబాటులో ఉన్న స్టోర్లు:",
    periodicRecommendationPrefix: "ఉత్తమ సిఫారసు:",
    periodicPredictionPrefix: "అంచనా:",
    periodicFooter: ["మరిన్ని LPG అప్డేట్‌ల కోసం మా వెంట ఉండండి.", "", "- LPG Smart System"],
    smartSubject: "LPG స్మార్ట్ అలర్ట్",
    smartGreeting: (name) => `హలో ${name},`,
    smartIntro: "మీ నోటిఫికేషన్ ప్రాధాన్యతలకు సరిపోయే ముఖ్యమైన LPG అప్డేట్ మాకు కనిపించింది.",
    smartFooter: ["తాజా శాఖ వివరాల కోసం యాప్‌ను పరిశీలించండి.", "", "- LPG Smart System"]
  }
};

function getLanguageCopy(language = "en") {
  return EMAIL_COPY[language] || EMAIL_COPY.en;
}

function getSystemAlertRecipient() {
  return process.env.EMAIL_TO || process.env.EMAIL_USER || null;
}

function createTransporter() {
  const { EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("[email] Gmail is not configured. Please set EMAIL_USER and EMAIL_PASS.");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
}

function formatAvailability(store) {
  return store.availability ? "Available" : "Not Available";
}

function formatStockCount(store) {
  const parsedStock = Number(store?.stockCount ?? 0);
  return Number.isFinite(parsedStock) ? parsedStock : 0;
}

function formatPreferenceValue(label, value) {
  return `${label}: ${value}`;
}

function buildPreferenceSummaryLines(user) {
  return [
    formatPreferenceValue("Max Price", user.maxPrice == null ? "Not set" : `Rs. ${user.maxPrice}`),
    formatPreferenceValue("Max Distance", user.maxDistance == null ? "Not set" : `${user.maxDistance} km`),
    formatPreferenceValue("Notifications Enabled", user.notificationsEnabled === false ? "No" : "Yes"),
    formatPreferenceValue("Preferred Language", user.preferredLanguage || "en")
  ];
}

function buildMailPayload({ recipients, subject, text }) {
  return {
    from: process.env.EMAIL_USER,
    to: recipients,
    subject,
    text
  };
}

function printEmailToConsole(payload, label = "email") {
  console.log("[email] Real email is not configured. Printing email content to console.");
  console.log(`[email] ----- ${label.toUpperCase()} PREVIEW START -----`);
  console.log(`Subject: ${payload.subject}`);
  console.log(payload.text);
  console.log(`[email] ----- ${label.toUpperCase()} PREVIEW END -----`);
}

async function dispatchEmail({ recipients, subject, text, label }) {
  const transporter = createTransporter();
  const payload = buildMailPayload({ recipients, subject, text });

  if (!recipients) {
    printEmailToConsole(payload, label);
    return { skipped: true, mode: "console-no-recipient" };
  }

  if (!transporter) {
    printEmailToConsole(payload, label);
    return { skipped: true, mode: "console" };
  }

  try {
    await transporter.sendMail(payload);
    console.log(`[email] ${label} sent successfully to ${recipients}.`);
    return { skipped: false, mode: "smtp" };
  } catch (error) {
    console.error(`[email] Failed to send ${label} to ${recipients}:`, error.message);
    printEmailToConsole(payload, label);
    return { skipped: true, mode: "console-fallback" };
  }
}

function buildStoreListLines(stores) {
  if (!stores.length) {
    return ["No LPG stores are currently marked as available."];
  }

  return stores.map((store, index) => (
    `${index + 1}. ${store.name} - ${store.city || store.location}, Rs. ${store.price}, ${store.distance} km away`
  ));
}

function buildSmartAlertLines(alerts = []) {
  if (!alerts.length) {
    return ["No smart alerts matched this user at the moment."];
  }

  return alerts.map((alert, index) => {
    if (alert.type === "price_drop") {
      return `${index + 1}. Price drop at ${alert.store.name}: Rs. ${alert.previousPrice} -> Rs. ${alert.currentPrice}`;
    }

    if (alert.type === "low_stock") {
      return `${index + 1}. Low stock at ${alert.store.name}: only ${alert.currentStock} cylinders left`;
    }

    return `${index + 1}. Update at ${alert.store.name}`;
  });
}

function buildAvailabilityDigestLines(stores = []) {
  if (!stores.length) {
    return ["No newly available LPG stores were detected in this cycle."];
  }

  return stores.map((store, index) => (
    `${index + 1}. ${store.name} - ${store.city || store.location}, Rs. ${store.price}, stock ${formatStockCount(store)}`
  ));
}

function buildRequestMatchLines(matches = []) {
  if (!matches.length) {
    return [];
  }

  return matches.map((match, index) => (
    `${index + 1}. ${match.store.name} - ${[match.store.city, match.store.state].filter(Boolean).join(", ") || match.store.location}, Rs. ${match.store.price}, ${match.store.distance} km`
  ));
}

function appendSection(lines, title, sectionLines) {
  if (!sectionLines.length) {
    return;
  }

  lines.push(title);
  lines.push(...sectionLines);
  lines.push("");
}

async function sendAvailabilityDigestEmail(stores) {
  if (!stores.length) {
    console.log("[email] Skipping system availability digest because there are no matching stores.");
    return { skipped: true, mode: "no-content" };
  }

  return dispatchEmail({
    recipients: getSystemAlertRecipient(),
    subject: "LPG Available Alert",
    text: [
      "The following LPG stores became available in this cycle:",
      "",
      ...buildAvailabilityDigestLines(stores),
      "",
      "- LPG Smart System"
    ].join("\n"),
    label: "system availability digest"
  });
}

async function sendAvailabilityEmail(store) {
  return sendAvailabilityDigestEmail(store ? [store] : []);
}

async function sendStockAvailabilityEmail(user, store) {
  const copy = getLanguageCopy(user.preferredLanguage);
  const stockCount = formatStockCount(store);

  return dispatchEmail({
    recipients: user.email,
    subject: "LPG Available Alert",
    text: [
      copy.smartGreeting(user.name),
      "",
      "LPG stock is now available for a store that matches your notification settings.",
      "",
      `Store Name: ${store.name}`,
      `City: ${store.city || store.location || "Not specified"}`,
      `Price: Rs. ${store.price}`,
      `Stock Count: ${stockCount}`,
      "",
      "- LPG Smart System"
    ].join("\n"),
    label: `stock availability alert for ${user.email}`
  });
}

async function sendWelcomeEmail(user) {
  const copy = getLanguageCopy(user.preferredLanguage);

  return dispatchEmail({
    recipients: user.email,
    subject: copy.welcomeSubject,
    text: [
      copy.welcomeGreeting(user.name),
      "",
      copy.welcomeIntro,
      "",
      "You will now receive updates about LPG availability, prices, and nearby stores.",
      "",
      "Thank you for joining us.",
      "",
      "- LPG Smart System"
    ].join("\n"),
    label: `welcome email for ${user.email}`
  });
}

async function sendLoginGreetingEmail(user) {
  const copy = getLanguageCopy(user.preferredLanguage);

  return dispatchEmail({
    recipients: user.email,
    subject: copy.loginSubject,
    text: [
      copy.loginGreeting(user.name),
      "",
      copy.loginIntro,
      "",
      "You can continue using LPG search, booking requests, price tracking, and personalized notifications.",
      "",
      "- LPG Smart System"
    ].join("\n"),
    label: `login greeting for ${user.email}`
  });
}

async function sendPreferenceSummaryEmail(user, mode = "summary") {
  const copy = getLanguageCopy(user.preferredLanguage);
  const isUpdate = mode === "updated";

  return dispatchEmail({
    recipients: user.email,
    subject: isUpdate ? copy.preferenceUpdatedSubject : copy.preferenceSubject,
    text: [
      copy.preferenceGreeting(user.name),
      "",
      isUpdate ? copy.preferenceUpdatedIntro : copy.preferenceIntro,
      "",
      ...buildPreferenceSummaryLines(user),
      "",
      "- LPG Smart System"
    ].join("\n"),
    label: `preference summary for ${user.email}`
  });
}

async function sendPeriodicUpdateEmail(user, availableStores, recommendation) {
  const copy = getLanguageCopy(user.preferredLanguage);
  const recommendationLine = recommendation
    ? `${copy.periodicRecommendationPrefix} ${recommendation.name} - Rs. ${recommendation.price} in ${recommendation.location}, ${recommendation.city || recommendation.state}`
    : `${copy.periodicRecommendationPrefix} No recommendation available right now.`;
  const predictionLine = recommendation?.prediction
    ? `${copy.periodicPredictionPrefix} ${recommendation.prediction}`
    : `${copy.periodicPredictionPrefix} No short-term availability prediction right now.`;

  return dispatchEmail({
    recipients: user.email,
    subject: copy.periodicSubject,
    text: [
      copy.periodicGreeting(user.name),
      "",
      copy.periodicIntro,
      "",
      copy.periodicStoresLabel,
      ...buildStoreListLines(availableStores),
      "",
      recommendationLine,
      predictionLine,
      "",
      ...copy.periodicFooter
    ].join("\n"),
    label: `periodic LPG update for ${user.email}`
  });
}

async function sendSmartNotificationEmail(user, alerts) {
  const copy = getLanguageCopy(user.preferredLanguage);

  return dispatchEmail({
    recipients: user.email,
    subject: copy.smartSubject,
    text: [
      copy.smartGreeting(user.name),
      "",
      copy.smartIntro,
      "",
      ...buildSmartAlertLines(alerts),
      "",
      ...copy.smartFooter
    ].join("\n"),
    label: `smart LPG alert for ${user.email}`
  });
}

async function sendRequestedLpgAvailableEmail(user, request, store) {
  return dispatchEmail({
    recipients: user.email,
    subject: "Your requested LPG is now available",
    text: [
      `Hello ${user.name},`,
      "",
      "Your requested LPG is now available.",
      "",
      `Store Name: ${store.name}`,
      `Price: Rs. ${store.price}`,
      `Location: ${[store.city, store.state].filter(Boolean).join(", ") || store.location || "Not specified"}`,
      `Distance: ${store.distance} km`,
      "",
      "- LPG Smart System"
    ].join("\n"),
    label: `request match alert for ${user.email}`
  });
}

async function sendUserLpgDigestEmail(user, summary = {}) {
  const copy = getLanguageCopy(user.preferredLanguage);
  const restockLines = buildAvailabilityDigestLines(summary.restockStores || []);
  const preferredStoreLines = buildStoreListLines(summary.availableStores || []);
  const smartAlertLines = buildSmartAlertLines(summary.smartAlerts || []);
  const requestMatchLines = buildRequestMatchLines(summary.requestMatches || []);
  const recommendationLine = summary.recommendation
    ? `${copy.periodicRecommendationPrefix} ${summary.recommendation.name} - Rs. ${summary.recommendation.price} in ${summary.recommendation.location}, ${summary.recommendation.city || summary.recommendation.state}`
    : `${copy.periodicRecommendationPrefix} No recommendation available right now.`;

  const lines = [
    copy.periodicGreeting(user.name),
    "",
    copy.periodicIntro,
    ""
  ];

  appendSection(lines, "Stores back in stock:", summary.restockStores?.length ? restockLines : []);
  appendSection(lines, copy.periodicStoresLabel, summary.availableStores?.length ? preferredStoreLines : []);
  appendSection(lines, "Smart alerts:", summary.smartAlerts?.length ? smartAlertLines : []);
  appendSection(lines, "Requested stores now available:", summary.requestMatches?.length ? requestMatchLines : []);

  lines.push(recommendationLine);

  if (summary.recommendation?.prediction) {
    lines.push(`${copy.periodicPredictionPrefix} ${summary.recommendation.prediction}`);
  }

  lines.push("");
  lines.push(...copy.periodicFooter);

  return dispatchEmail({
    recipients: user.email,
    subject: copy.periodicSubject,
    text: lines.join("\n"),
    label: `combined LPG digest for ${user.email}`
  });
}

module.exports = {
  sendAvailabilityDigestEmail,
  sendAvailabilityEmail,
  sendLoginGreetingEmail,
  sendPeriodicUpdateEmail,
  sendPreferenceSummaryEmail,
  sendRequestedLpgAvailableEmail,
  sendStockAvailabilityEmail,
  sendSmartNotificationEmail,
  sendUserLpgDigestEmail,
  sendWelcomeEmail
};
