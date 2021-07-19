import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import PlayerGameView from '../../PlayerGameView/PlayerGameView';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { Intersection, Vector2 } from '@casual-simulation/three';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import {
    BotCalculationContext,
    getBotPosition,
    objectsAtDimensionGridPosition,
    getBotIndex,
    duplicateBot,
    Bot,
    tagsOnBot,
    CLICK_ACTION_NAME,
    ANY_CLICK_ACTION_NAME,
    onClickArg,
    onAnyClickArg,
} from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { PlayerBotDragOperation } from '../DragOperation/PlayerBotDragOperation';
import { dropWhile } from 'lodash';
import { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import { PlayerNewBotDragOperation } from '../DragOperation/PlayerNewBotDragOperation';
import { MiniSimulation3D } from '../../scene/MiniSimulation3D';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import { ControllerData, InputMethod } from '../../../shared/scene/Input';
import { MapSimulation3D } from '../../scene/MapSimulation3D';

export class PlayerBotClickOperation extends BaseBotClickOperation {
    // This overrides the base class.
    protected _interaction: PlayerInteractionManager;

    protected _face: string;

    constructor(
        simulation3D: Simulation3D,
        interaction: PlayerInteractionManager,
        bot: AuxBot3D,
        faceValue: string,
        inputMethod: InputMethod,
        hit: Intersection
    ) {
        super(simulation3D, interaction, bot.bot, bot, inputMethod, hit);

        this._face = faceValue;
    }

    protected _performClick(calc: BotCalculationContext): void {
        const bot3D: AuxBot3D = <AuxBot3D>this._bot3D;

        this.simulation.helper.action(
            CLICK_ACTION_NAME,
            [this._bot],
            onClickArg(this._face, bot3D.dimension)
        );

        this.simulation.helper.action(
            ANY_CLICK_ACTION_NAME,
            null,
            onAnyClickArg(this._face, bot3D.dimension, this._bot)
        );
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseBotDragOperation {
        const bot3D: AuxBot3D = <AuxBot3D>this._bot3D;
        const dimension = bot3D.dimension;
        const position = getBotPosition(calc, bot3D.bot, dimension);
        if (position) {
            const objects = objectsAtDimensionGridPosition(
                calc,
                dimension,
                position
            );
            if (objects.length === 0) {
                console.log('Found no objects at', position);
                console.log(bot3D.bot);
                console.log(dimension);
                return null;
            }
            const bot = this._bot;
            const draggedObjects = dropWhile(objects, (o) => o.id !== bot.id);
            const {
                playerSimulation3D,
                miniSimulation3D,
                mapSimulation3D,
            } = this._getSimulationsForDragOp();

            return new PlayerBotDragOperation(
                playerSimulation3D,
                miniSimulation3D,
                mapSimulation3D,
                this._interaction,
                draggedObjects,
                bot3D.dimension,
                this._inputMethod,
                fromCoord,
                undefined,
                this._face,
                this._hit
            );
        }

        return null;
    }

    private _getSimulationsForDragOp() {
        let playerSimulation3D: PlayerPageSimulation3D;
        let miniSimulation3D: MiniSimulation3D;
        let mapSimulation3D: MapSimulation3D;

        if (this._simulation3D instanceof PlayerPageSimulation3D) {
            playerSimulation3D = this._simulation3D;
            miniSimulation3D = (<PlayerGame>this.game).findMiniSimulation3D(
                this._simulation3D.simulation
            );
            mapSimulation3D = (<PlayerGame>this.game).findMapSimulation3D(
                this._simulation3D.simulation
            );
        } else if (this._simulation3D instanceof MiniSimulation3D) {
            playerSimulation3D = (<PlayerGame>this.game).findPlayerSimulation3D(
                this._simulation3D.simulation
            );
            miniSimulation3D = this._simulation3D;
            mapSimulation3D = (<PlayerGame>this.game).findMapSimulation3D(
                this._simulation3D.simulation
            );
        } else if (this._simulation3D instanceof MapSimulation3D) {
            playerSimulation3D = (<PlayerGame>this.game).findPlayerSimulation3D(
                this._simulation3D.simulation
            );
            miniSimulation3D = (<PlayerGame>this.game).findMiniSimulation3D(
                this._simulation3D.simulation
            );
            mapSimulation3D = this._simulation3D;
        } else {
            console.error(
                '[PlayerBotClickOperation] Unsupported Simulation3D type for drag operation.'
            );
        }

        return { playerSimulation3D, miniSimulation3D, mapSimulation3D };
    }
}
