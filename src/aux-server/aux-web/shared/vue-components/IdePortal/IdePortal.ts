import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    BotTags,
    ON_SHEET_TAG_CLICK,
    ON_SHEET_BOT_ID_CLICK,
    ON_SHEET_BOT_CLICK,
    toast,
    tweenTo,
    SHEET_PORTAL,
    CLICK_ACTION_NAME,
    onClickArg,
    IDE_PORTAL,
} from '@casual-simulation/aux-common';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { SubscriptionLike } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { tap } from 'rxjs/operators';
import { IdePortalConfig } from './IdePortalConfig';
import { IdeNode } from '@casual-simulation/aux-vm-browser';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import BotTag from '../BotTag/BotTag';

@Component({
    components: {
        'tag-value-editor': TagValueEditor,
        'bot-tag': BotTag,
    },
})
export default class IdePortal extends Vue {
    items: IdeNode[] = [];
    hasPortal: boolean = false;

    showButton: boolean = true;
    buttonIcon: string = null;
    buttonHint: string = null;

    currentBot: Bot = null;
    currentTag: string = null;
    currentSpace: string = null;
    selectedItem: IdeNode = null;

    private _simulation: BrowserSimulation;
    private _currentConfig: IdePortalConfig;

    get finalButtonIcon() {
        if (hasValue(this.buttonIcon)) {
            return this.buttonIcon;
        }
        return 'web_asset';
    }

    get finalButtonHint() {
        if (hasValue(this.buttonHint)) {
            return this.buttonHint;
        }
        return 'Page Portal';
    }

    constructor() {
        super();
    }

    created() {
        appManager.whileLoggedIn((user, botManager) => {
            let subs: SubscriptionLike[] = [];
            this._simulation = appManager.simulationManager.primary;
            this.items = [];
            this.hasPortal = false;
            this.currentBot = null;
            this.currentTag = null;
            this.currentSpace = null;
            this.selectedItem = null;

            subs.push(
                this._simulation.idePortal.itemsUpdated.subscribe((e) => {
                    this.items = e.items;
                    this.hasPortal = e.hasPortal;
                })
            );
            this._currentConfig = new IdePortalConfig(IDE_PORTAL, botManager);
            subs.push(
                this._currentConfig,
                this._currentConfig.onUpdated
                    .pipe(
                        tap(() => {
                            this._updateConfig();
                        })
                    )
                    .subscribe()
            );
            return subs;
        });
    }

    selectItem(item: IdeNode) {
        if (item.type === 'tag') {
            this.selectedItem = item;
            this.currentBot = this._simulation.helper.botsState[item.botId];
            this.currentTag = item.tag;
            this.currentSpace = null;
        }
    }

    tagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        this._simulation.helper.setEditingBot(bot, tag);
    }

    async exitPortal() {
        if (this._currentConfig) {
            const result = await this._simulation.helper.shout(
                CLICK_ACTION_NAME,
                [this._currentConfig.configBot],
                onClickArg(null, null)
            );

            if (result.results.length <= 0) {
                this._exitPortal();
            }
        } else {
            this._exitPortal();
        }
    }

    private _exitPortal() {
        let tags: BotTags = {
            idePortal: null,
        };
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: tags,
        });
    }

    // async botClick(bot: Bot) {
    //     const result = await this._simulation.helper.shout(
    //         ON_SHEET_BOT_CLICK,
    //         null,
    //         {
    //             bot: bot,
    //         }
    //     );
    //     if (result.results.length <= 0) {
    //         this.exitSheet();
    //         this._simulation.helper.transaction(
    //             tweenTo(bot.id, undefined, undefined, undefined, 0)
    //         );
    //     }
    // }

    // async botIDClick(id: string) {
    //     const result = await this._simulation.helper.shout(
    //         ON_SHEET_BOT_ID_CLICK,
    //         null,
    //         {
    //             bot: this._simulation.helper.botsState[id],
    //         }
    //     );
    //     if (result.results.length <= 0) {
    //         copyToClipboard(id);
    //         this._simulation.helper.transaction(toast('Copied!'));
    //     }
    // }

    // async goToTag(tag: string) {
    //     const result = await this._simulation.helper.shout(
    //         ON_SHEET_TAG_CLICK,
    //         null,
    //         {
    //             tag: tag,
    //         }
    //     );
    //     if (result.results.length <= 0) {
    //         this._simulation.helper.updateBot(this._simulation.helper.userBot, {
    //             tags: {
    //                 sheetPortal: tag,
    //             },
    //         });
    //     }
    // }

    private _updateConfig() {
        if (this._currentConfig) {
            this.showButton = this._currentConfig.showButton;
            this.buttonIcon = this._currentConfig.buttonIcon;
            this.buttonHint = this._currentConfig.buttonHint;
        } else {
            this.showButton = true;
            this.buttonIcon = null;
            this.buttonHint = null;
        }
    }
}
