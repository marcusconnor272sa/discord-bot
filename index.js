require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const mongoose = require("mongoose");

// =========================
// CLIENT SETUP
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
// MONGODB CONNECT
// =========================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ MongoDB Error:", err));

// =========================
// TICKET SCHEMA
// =========================
const ticketSchema = new mongoose.Schema({
    userId: String,
    channelId: String,
    reason: String,
    status: { type: String, default: "open" },
    createdAt: { type: Date, default: Date.now }
});

const Ticket = mongoose.model("Ticket", ticketSchema);

// =========================
// CRASH PROTECTION
// =========================
process.on("unhandledRejection", err => {
    console.log("⚠️ Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
    console.log("⚠️ Uncaught Exception:", err);
});

// =========================
// READY
// =========================
client.once(Events.ClientReady, () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
});

// =========================
// PREFIX
// =========================
const prefix = process.env.PREFIX || ".";

// =========================
// MESSAGE COMMANDS
// =========================
client.on(Events.MessageCreate, async (message) => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    console.log(`COMMAND USED: ${command}`);

    // 🏓 PING
    if (command === "ping") {
        return message.reply(`🏓 Pong! ${client.ws.ping}ms`);
    }

    // 📊 STATUS
    if (command === "status") {
        const embed = new EmbedBuilder()
            .setTitle("📊 Bot Status")
            .addFields(
                { name: "Ping", value: `${client.ws.ping}ms`, inline: true },
                { name: "Uptime", value: `${Math.floor(client.uptime / 1000)}s`, inline: true }
            )
            .setColor("Green");

        return message.reply({ embeds: [embed] });
    }

    // 🎟️ TICKET PANEL
    if (command === "ticketpanel") {
        const embed = new EmbedBuilder()
            .setTitle("🎟️ Ticket System")
            .setDescription("Select a category to create a ticket.")
            .setColor("Blue");

        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("Choose ticket type")
            .addOptions(
                { label: "Support", value: "support" },
                { label: "Report", value: "report" },
                { label: "Billing", value: "billing" }
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return message.channel.send({
            embeds: [embed],
            components: [row]
        });
    }
});

// =========================
// INTERACTIONS
// =========================
client.on(Events.InteractionCreate, async (interaction) => {

    // 🎟️ DROPDOWN SELECT
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {

        const type = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${type}`)
            .setTitle("Create Ticket");

        const reason = new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Explain your issue")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(reason);
        modal.addComponents(row);

        return interaction.showModal(modal);
    }

    // 🧾 MODAL SUBMIT (CREATE TICKET)
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_modal_")) {

        const reason = interaction.fields.getTextInputValue("reason");

        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: 0
        });

        const ticket = new Ticket({
            userId: interaction.user.id,
            channelId: channel.id,
            reason
        });

        await ticket.save();

        const embed = new EmbedBuilder()
            .setTitle("🎟️ Ticket Opened")
            .setDescription(`Reason: ${reason}`)
            .setColor("Green");

        const closeBtn = new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("Close Ticket")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeBtn);

        await channel.send({
            content: `<@${interaction.user.id}>`,
            embeds: [embed],
            components: [row]
        });

        return interaction.reply({
            content: `✅ Ticket created: ${channel}`,
            ephemeral: true
        });
    }

    // 🔒 CLOSE TICKET
    if (interaction.isButton() && interaction.customId === "close_ticket") {

        await Ticket.findOneAndUpdate(
            { channelId: interaction.channel.id },
            { status: "closed" }
        );

        await interaction.reply("🔒 Closing ticket...");

        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 3000);
    }
});

// =========================
// LOGIN
// =========================
client.login(process.env.DISCORD_TOKEN);