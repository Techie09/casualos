
/**
 * Gets information about a reserved site.
 * The goal behind this interface is to allow supporting the idea of "reserving" a site ID
 * for a causal tree and eventually allowing other sites to validate atoms sent from devices that
 * claim to represent a given site.
 */
export interface SiteInfo {
    /**
     * The ID of the site.
     */
    id: number;
}

/**
 * Creates a new SiteInfo object with the given ID.
 * @param id The ID.
 */
export function site(id: number): SiteInfo {
    return {
        id: id
    };
}