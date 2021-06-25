import { Input, InputMethod } from '../../../shared/scene/Input';
import { Ray } from '@casual-simulation/three';
import { appManager } from '../../../shared/AppManager';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { MiniSimulation3D } from '../../scene/MiniSimulation3D';
import { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import { Physics } from '../../../shared/scene/Physics';
import { PlayerGame } from '../../scene/PlayerGame';
import { BaseEmptyClickOperation } from '../../../shared/interaction/ClickOperation/BaseEmptyClickOperation';
import {
    BotCalculationContext,
    ON_GRID_CLICK_ACTION_NAME,
    ON_GRID_DOWN_ACTION_NAME,
    ON_GRID_UP_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { objectForwardRay } from '../../../shared/scene/SceneUtils';
import { Simulation } from '@casual-simulation/aux-vm';
import { Grid3D } from '../../../shared/scene/Grid3D';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class PlayerEmptyClickOperation extends BaseEmptyClickOperation {
    protected _game: PlayerGame;
    protected _interaction: PlayerInteractionManager;

    get simulation() {
        return appManager.simulationManager.primary;
    }

    constructor(
        game: PlayerGame,
        interaction: PlayerInteractionManager,
        inputMethod: InputMethod
    ) {
        super(game, interaction, inputMethod);
        this._game = game;
        this._interaction = interaction;
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    protected _performClick(calc: BotCalculationContext): void {
        this._sendOnGridClickEvent(calc);
    }

    protected _performUp(calc: BotCalculationContext): void {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_UP_ACTION_NAME, null, arg);
        });
    }

    protected _performDown(calc: BotCalculationContext): void {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_DOWN_ACTION_NAME, null, arg);
        });
    }

    private _sendOnGridClickEvent(calc: BotCalculationContext) {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_CLICK_ACTION_NAME, null, arg);
        });
    }

    private _sendGridEvent(
        calc: BotCalculationContext,
        sendAction: (simulation: Simulation, arg: any) => void
    ) {
        const simulation3Ds = this._game.getSimulations();

        for (const sim3D of simulation3Ds) {
            if (sim3D instanceof PlayerPageSimulation3D) {
                let inputDimension: string;
                let inputRay: Ray;
                let grid: Grid3D = sim3D.grid3D;

                // Calculate input ray.
                if (this._controller) {
                    inputRay = objectForwardRay(this._controller.ray);
                    inputDimension = sim3D.dimension;
                } else {
                    const pagePos = this._game.getInput().getMousePagePos();
                    const viewports = this._game.getViewports();
                    const miniViewport = this._game.getMiniPortalViewport();
                    const mapViewport = this._game.getMapPortalViewport();
                    const isMiniPortal = Input.pagePositionOnViewport(
                        pagePos,
                        miniViewport,
                        viewports
                    );
                    const isMapPortal = Input.pagePositionOnViewport(
                        pagePos,
                        mapViewport,
                        viewports
                    );

                    if (isMiniPortal) {
                        const mini = this._game.findMiniSimulation3D(
                            sim3D.simulation
                        );
                        inputRay = Physics.screenPosToRay(
                            Input.screenPositionForViewport(
                                pagePos,
                                miniViewport
                            ),
                            mini.getMainCameraRig().mainCamera
                        );
                        inputDimension = mini.miniDimension;
                        grid = mini.grid3D;
                    } else if (isMapPortal) {
                        const map = this._game.findMapSimulation3D(
                            sim3D.simulation
                        );
                        inputRay = Physics.screenPosToRay(
                            Input.screenPositionForViewport(
                                pagePos,
                                mapViewport
                            ),
                            map.getMainCameraRig().mainCamera
                        );
                        inputDimension = map.mapDimension;
                        grid = map.grid3D;
                    } else {
                        inputRay = Physics.screenPosToRay(
                            this._game.getInput().getMouseScreenPos(),
                            sim3D.getMainCameraRig().mainCamera
                        );
                        inputDimension = sim3D.dimension;
                        grid = sim3D.grid3D;
                    }
                }

                // Get grid tile that intersects with input ray.
                const gridTile = grid.getTileFromRay(inputRay, true);

                let position: any = {
                    x: Infinity,
                    Y: Infinity,
                };
                if (gridTile) {
                    position = {
                        x: gridTile.tileCoordinate.x,
                        y: gridTile.tileCoordinate.y,
                    };
                }
                sendAction(sim3D.simulation, {
                    dimension: inputDimension,
                    position: position,
                });
            }
        }
    }
}
