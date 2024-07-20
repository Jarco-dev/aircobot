import { HandlerResult } from "@/types";
import { ButtonComponent } from "@/structures";
import {
    ButtonInteraction,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} from "discord.js";
import CringeLeaderboardPreviousPageButtonComponent from "@/button/fun/CringeLeaderboardPreviousPage";
import CringeLeaderboardSelectPageStartButtonComponent from "@/button/fun/CringeLeaderboardSelectPageStart";

export default class CringeLeaderboardNextPageButtonComponent extends ButtonComponent {
    public static readonly builder = new ButtonBuilder()
        .setCustomId("cringeLeaderboardNextPage")
        .setStyle(ButtonStyle.Success)
        .setLabel(">");

    constructor() {
        super({
            builder: CringeLeaderboardNextPageButtonComponent.builder
        });
    }

    public async run(i: ButtonInteraction): Promise<HandlerResult> {
        const context = await this.client.redis.getMessageContext(
            "cringeLeaderboard",
            i.message.id
        );
        if (!context) {
            this.client.sender.reply(
                i,
                { ephemeral: true, components: [] },
                {
                    langLocation: "misc.actionExpired",
                    msgType: "INVALID",
                    method: "UPDATE"
                }
            );
            return { result: "ACTION_EXPIRED" };
        }
        if (i.user.id !== context.pageMenuOwnerId) {
            this.client.sender.reply(
                i,
                { ephemeral: true },
                { langLocation: "misc.missingPermissions", msgType: "INVALID" }
            );
            return { result: "USER_MISSING_PERMISSIONS" };
        }

        const dbRes: [{ received: bigint; given: bigint }] = await this.client
            .prisma
            .$queryRaw`SELECT COUNT(DISTINCT receivedByUserId) as received, COUNT(DISTINCT givenByUserId) as given FROM Cringes`;
        const userCount =
            context.type === "received"
                ? Number(dbRes[0].received)
                : Number(dbRes[0].given);
        if (userCount === 0) {
            this.client.redis.delMessageContext(
                "cringeLeaderboard",
                i.message.id
            );
            this.client.sender.reply(
                i,
                { ephemeral: true, components: [] },
                {
                    langLocation: "misc.pageMenuUnavailable",
                    msgType: "INVALID",
                    method: "UPDATE"
                }
            );
            return { result: "OTHER", note: "Menu no longer has any entries" };
        }

        const maxPage = Math.ceil(userCount / 10);
        const newPage = context.page < maxPage ? context.page + 1 : 1;
        const embed = await this.client.utils.getCringeLeaderboardPage(
            i,
            context.type,
            newPage
        );
        const buttons = new ActionRowBuilder<ButtonBuilder>().setComponents(
            CringeLeaderboardPreviousPageButtonComponent.builder,
            new ButtonBuilder(
                CringeLeaderboardSelectPageStartButtonComponent.builder.toJSON()
            ).setLabel(`${newPage}/${maxPage}`),
            CringeLeaderboardNextPageButtonComponent.builder
        );

        this.client.sender.reply(
            i,
            { embeds: [embed], components: userCount > 10 ? [buttons] : [] },
            { method: "UPDATE" }
        );
        if (userCount > 10) {
            this.client.redis.setMessageContext(
                "cringeLeaderboard",
                i.message.id,
                {
                    ...context,
                    page: newPage
                }
            );
        } else {
            this.client.redis.delMessageContext(
                "cringeLeaderboard",
                i.message.id
            );
        }

        return { result: "SUCCESS" };
    }
}