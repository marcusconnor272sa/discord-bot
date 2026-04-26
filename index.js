require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const mongoose = require("mongoose");

// =========================
// CONFIG
// =========================
const PREFIX = ".";
const LOG_CHANNEL_ID = "1498066281407053844";

const ROLES = {
    headStaff: "1497685714593120446",
    support: "1497703123794395378",
    nametag: "1497683509211431002"
};

// =========================
// CLIENT (FIXED INTENTS)
// =========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

// =========================
// DATABASE
// =========================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ MongoDB Error:", err));

// =========================
// TICKET DB
// =========================
const ticketSchema = new mongoose.Schema({
    userId: String,
    type: String,
    channelId: String,
    data: Object,
    status: { type: String, default: "open" },
    createdAt: { type: Date, default: Date.now }
});

const Ticket = mongoose.model("Ticket", ticketSchema);

// =========================
// BOT STATE
// =========================
let botState = "online";
const startTime = Date.now();

// =========================
// READY
// =========================
client.once(Events.ClientReady, () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
});

// =========================
// LOG SYSTEM
// =========================
async function sendLog(guild, embed) {
    const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!ch) return;
    ch.send({ embeds: [embed] }).catch(() => {});
}

// =========================
// MESSAGE COMMANDS (FIXED)
// =========================
client.on(Events.MessageCreate, async (message) => {

    if (!message.guild || message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift()?.toLowerCase();

    console.log("CMD:", cmd); // DEBUG

    // =========================
    // STATUS (LIVE)
    // =========================
    if (cmd === "status") {

        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const db = mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED";

        let color = 0x2ecc71;
        let state = "ONLINE";

        if (botState === "maintenance") {
            color = 0xf1c40f;
            state = "MAINTENANCE";
        }

        if (botState === "offline") {
            color = 0xe74c3c;
            state = "OFFLINE";
        }

        const embed = new EmbedBuilder()
            .setTitle("Ryze Data Base Status")
            .setColor(color)
            .addFields(
                { name: "Status", value: state, inline: true },
                { name: "Ping", value: `${client.ws.ping}ms`, inline: true },
                { name: "Uptime", value: `${uptime}s`, inline: true },
                { name: "Database", value: db, inline: true }
            )
            .setTimestamp();

        return message.channel.send({ embeds: [embed] });
    }

    // =========================
    // TICKET PANEL (FIXED)
    // =========================
    if (cmd === "ticketpanel") {

        const embed = new EmbedBuilder()
            .setTitle("Ryze Ticket System")
            .setDescription("Open a ticket for support")
            .setColor("Black");

        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("Select ticket type")
            .addOptions([
                { label: "Nametag", value: "nametag" },
                { label: "Whitelist", value: "whitelist" },
                { label: "Help", value: "help" }
            ]);

        return message.channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(menu)]
        });
    }

    // =========================
    // ANNOUNCEMENT
    // =========================
    if (cmd === "announce") {

        const text = args.join(" ");
        if (!text) return message.reply("Provide a message.");

        const embed = new EmbedBuilder()
            .setTitle("Ryze Announcement")
            .setDescription(text)
            .setColor("DarkGreen")
            .setTimestamp();

        return message.channel.send({
            content: "@everyone",
            embeds: [embed],
            allowedMentions: { parse: ["everyone"] }
        });
    }
});

// =========================
// INTERACTIONS
// =========================
client.on(Events.InteractionCreate, async (i) => {

    // =========================
    // MENU
    // =========================
    if (i.isStringSelectMenu() && i.customId === "ticket_select") {

        const type = i.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`ticket_${type}`)
            .setTitle(`${type.toUpperCase()} Ticket`);

        if (type === "nametag") {
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("roblox").setLabel("Roblox Username").setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("text").setLabel("Tag Text").setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("color").setLabel("Text Color").setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("bg").setLabel("Background Color").setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("outline").setLabel("Outline Color").setStyle(TextInputStyle.Short)
                )
            );
        }

        if (type === "whitelist") {
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("payment").setLabel("Paying With (Robux/Crypto)").setStyle(TextInputStyle.Short)
                )
            );
        }

        if (type === "help") {
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("help").setLabel("What do you need help with?").setStyle(TextInputStyle.Paragraph)
                )
            );
        }

        return i.showModal(modal);
    }

    // =========================
    // MODALS
    // =========================
    if (i.isModalSubmit()) {

        const type = i.customId.replace("ticket_", "");

        const channel = await i.guild.channels.create({
            name: `ticket-${i.user.username}`,
            type: 0
        });

        let data = {};

        if (type === "nametag") {
            data = {
                roblox: i.fields.getTextInputValue("roblox"),
                text: i.fields.getTextInputValue("text"),
                color: i.fields.getTextInputValue("color"),
                bg: i.fields.getTextInputValue("bg"),
                outline: i.fields.getTextInputValue("outline")
            };
        }

        if (type === "whitelist") {
            data = {
                payment: i.fields.getTextInputValue("payment")
            };
        }

        if (type === "help") {
            data = {
                help: i.fields.getTextInputValue("help")
            };
        }

        await Ticket.create({
            userId: i.user.id,
            type,
            channelId: channel.id,
            data
        });

        const embed = new EmbedBuilder()
            .setColor("Black")
            .setTitle(`${type.toUpperCase()} Ticket`)
            .setDescription("A staff member will be with you shortly.")
            .addFields({ name: "Info", value: JSON.stringify(data, null, 2) });

        const mentions = `<@&${ROLES.support}> <@&${ROLES.nametag}> <@&${ROLES.headStaff}>`;

        await channel.send({
            content: `${mentions} <@${i.user.id}>`,
            embeds: [embed]
        });

        // LOG
        sendLog(i.guild, new EmbedBuilder()
            .setTitle("Ticket Created")
            .setColor("Blue")
            .addFields(
                { name: "User", value: `<@${i.user.id}>` },
                { name: "Type", value: type }
            )
        );

        return i.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
    }
});

// =========================
// LOGIN
// =========================
client.login(process.env.DISCORD_TOKEN);