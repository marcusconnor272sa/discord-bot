const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Anti-crash
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.content === ".ping") {
    message.reply("Pong!");
  }
});

client.login(process.env.TOKEN);