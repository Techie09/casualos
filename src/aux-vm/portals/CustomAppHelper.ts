import {
    asyncError,
    asyncResult,
    AuxRuntime,
    BotAction,
    hasValue,
} from '@casual-simulation/aux-common';
import { AuxHelper } from '../vm';
import { HtmlAppBackend } from './HtmlAppBackend';
import { AppBackend } from './AppBackend';

/**
 * Defines a class that manages the backend of custom portals.
 */
export class CustomAppHelper {
    helper: AuxHelper;

    // TODO: implement portal backend that is passed all the updated bots and can determine when to call @onRender.
    portals: Map<string, AppBackend> = new Map();

    constructor(helper: AuxHelper) {
        this.helper = helper;
    }

    handleEvents(events: BotAction[]): void {
        // TODO: process register_custom_app events and create the corresponding backend objects.
        for (let event of events) {
            if (event.type === 'register_custom_app') {
                let appId = event.appId;

                let backend: AppBackend = new HtmlAppBackend(
                    appId,
                    event.botId,
                    this.helper,
                    event.taskId
                );

                const existing = this.portals.get(appId);
                if (existing) {
                    existing.dispose();
                }

                this.portals.set(appId, backend);
            } else if (event.type === 'unregister_custom_app') {
                try {
                    let appId = event.appId;

                    const existing = this.portals.get(appId);
                    if (existing) {
                        existing.dispose();
                    }

                    this.portals.delete(appId);

                    if (hasValue(event.taskId)) {
                        this.helper.transaction(
                            asyncResult(event.taskId, null)
                        );
                    }
                } catch (e) {
                    if (hasValue(event.taskId)) {
                        this.helper.transaction(asyncError(event.taskId, e));
                    }
                }
            }
        }

        for (let portal of this.portals.values()) {
            portal.handleEvents(events);
        }
    }
}
