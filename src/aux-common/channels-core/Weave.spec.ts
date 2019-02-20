import { Weave, WeaveReference } from "./Weave";
import { Atom, AtomId, AtomOp, atom, atomId } from "./Atom";


describe('Weave', () => {

    class Op implements AtomOp {
        type: number;
    }

    describe('insert()', () => {
        it('should return references', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            expect(ref1.atom.id.site).toBe(1);
            expect(ref1.index).toBe(0);
            expect(ref2.atom.id.site).toBe(1);
            expect(ref2.index).toBe(1);
            expect(ref3.atom.id.site).toBe(2);
            expect(ref3.index).toBe(0);

            const atoms = weave.atoms.map(a => a.atom);
            expect(atoms).toEqual([
                a1, a3, a2
            ]);
        });

        it('should order atoms based on their timestamp', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a3 = atom(atomId(2, 3), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            // Later atoms should be sorted before earlier ones
            // Therefore when adding an atom with time 2 it should be sorted after atom at time 3.
            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            expect(ref1.atom.id.site).toBe(1);
            expect(ref1.index).toBe(0);
            expect(ref2.atom.id.site).toBe(1);
            expect(ref2.index).toBe(1);
            expect(ref3.atom.id.site).toBe(2);
            expect(ref3.index).toBe(0);

            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1, a3, a2
            ]);
        });

        it('should order atoms based on their site ID if timestamp is equal', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            
            const a3 = atom(atomId(2, 2), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            // Lower Site IDs should be sorted before higher ones
            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            expect(ref1.atom.id.site).toBe(1);
            expect(ref1.index).toBe(0);
            expect(ref2.atom.id.site).toBe(1);
            expect(ref2.index).toBe(1);
            expect(ref3.atom.id.site).toBe(2);
            expect(ref3.index).toBe(0);

            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1, a2, a3
            ]);
        });

        it('should consider priority for sorting', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a3 = atom(atomId(2, 4), atomId(1, 1), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(3, 2, 1), atomId(1, 1), new Op());
            const ref4 = weave.insert(a4);

            const a2 = atom(atomId(1, 3), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            expect(ref1.atom.id.site).toBe(1);
            expect(ref1.index).toBe(0);
            expect(ref2.atom.id.site).toBe(1);
            expect(ref2.index).toBe(1);
            expect(ref3.atom.id.site).toBe(2);
            expect(ref3.index).toBe(0);
            expect(ref4.atom.id.site).toBe(3);
            expect(ref4.index).toBe(0);

            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1, a4, a3, a2
            ]);
        });

        it('should handle deeply nested atoms', () => {
            let weave = new Weave();

            const a1 = atom(atomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = atom(atomId(2, 2), atomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            const a3 = atom(atomId(2, 3), atomId(2, 2), new Op());
            const ref3 = weave.insert(a3);

            const a4 = atom(atomId(1, 4), atomId(2, 3), new Op());
            const ref4 = weave.insert(a4);

            const a5 = atom(atomId(1, 5), atomId(1, 1), new Op());
            const ref5 = weave.insert(a5);

            expect(ref1.atom.id.site).toBe(1);
            expect(ref1.index).toBe(0);
            expect(ref2.atom.id.site).toBe(2);
            expect(ref2.index).toBe(0);
            expect(ref3.atom.id.site).toBe(2);
            expect(ref3.index).toBe(1);
            expect(ref4.atom.id.site).toBe(1);
            expect(ref4.index).toBe(1);
            expect(ref5.atom.id.site).toBe(1);
            expect(ref5.index).toBe(2);

            expect(weave.atoms.map(a => a.atom)).toEqual([
                a1, 
                a5, 
                a2, a3, a4
            ]);
        });
    });

    describe('getSite()', () => {
        it('should return atoms in order of their timestamps', () => {
            const a1 = atom(atomId(1, 1), null, new Op());
            const a2 = atom(atomId(1, 2), atomId(1, 1), new Op());
            const a3 = atom(atomId(1, 3), atomId(1, 1), new Op());
            const a4 = atom(atomId(1, 4), atomId(1, 2), new Op());

            let weave = new Weave();

            const a1Ref = weave.insert(a1);
            const a3Ref = weave.insert(a3);
            const a2Ref = weave.insert(a2);
            const a4Ref = weave.insert(a4);

            const site = weave.getSite(1);

            expect(site.get(0)).toEqual(a1Ref);
            expect(site.get(1)).toEqual(a2Ref);
            expect(site.get(2)).toEqual(a3Ref);
            expect(site.get(3)).toEqual(a4Ref);
        });
    });

    describe('import()', () => {

        it('should add the given list of atoms to the list verbatim', () => {
            let weave = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());

            weave.insertMany(root, child1, child2, child3);

            const refs = weave.atoms;

            let newWeave = new Weave<Op>();
            newWeave.import(refs);

            expect(newWeave.atoms.map(a => a.atom)).toEqual([
                root,
                child2,
                child1,
                child3,
            ]);

            const site = newWeave.getSite(1);

            expect(site.get(0).atom).toBe(root);
            expect(site.get(1).atom).toBe(child1);
            expect(site.get(2).atom).toBe(child2);
            expect(site.get(3).atom).toBe(child3);
        });

        it('should be able to merge another weave into itself', () => {
            let first = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child6 = atom<Op>(atomId(1, 6), child2.id, new Op());

            first.insertMany(root, child1, child2, child3, child6);

            let second = new Weave<Op>();

            const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
            const child5 = atom<Op>(atomId(2, 5), child1.id, new Op());

            second.insertMany(root, child1, child2, child3, child4, child5);

            const firstRefs = first.atoms;
            const secondRefs = second.atoms;

            let newWeave = new Weave<Op>();
            newWeave.import(firstRefs);
            newWeave.import(secondRefs);

            const atoms = newWeave.atoms.map(a => a.atom);
            expect(atoms[0]).toEqual(root);
            expect(atoms[1]).toEqual(child4);
            expect(atoms[2]).toEqual(child2);
            expect(atoms[3]).toEqual(child6);
            expect(atoms[4]).toEqual(child1);
            expect(atoms[5]).toEqual(child5);
            expect(atoms[6]).toEqual(child3);
            expect(atoms.length).toBe(7);
        });

        it('should be able to merge a partial weave into itself', () => {
            let first = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child6 = atom<Op>(atomId(1, 6), child2.id, new Op());

            first.insertMany(root, child1, child2, child3, child6);

            let second = new Weave<Op>();

            const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
            const child5 = atom<Op>(atomId(2, 5), child1.id, new Op());

            second.insertMany(root, child1, child4, child5);

            const firstRefs = first.atoms;
            const secondRefs = second.atoms;

            let newWeave = new Weave<Op>();
            newWeave.import(firstRefs);

            // Note that the partial weave must contain a complete causal chain.
            // That is, every parent node to the leafs
            newWeave.import(secondRefs);

            const atoms = newWeave.atoms.map(a => a.atom);
            expect(atoms[0]).toEqual(root);
            expect(atoms[1]).toEqual(child4);
            expect(atoms[2]).toEqual(child2);
            expect(atoms[3]).toEqual(child6);
            expect(atoms[4]).toEqual(child1);
            expect(atoms[5]).toEqual(child5);
            expect(atoms[6]).toEqual(child3);
            expect(atoms.length).toBe(7);
        });

        it('should be able to merge a deep weave into itself', () => {
            let first = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child6 = atom<Op>(atomId(1, 6), child2.id, new Op());
            const child9 = atom<Op>(atomId(1, 7), child6.id, new Op());

            first.insertMany(root, child1, child2, child3, child6, child9);

            let second = new Weave<Op>();

            const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
            const child5 = atom<Op>(atomId(2, 5), child1.id, new Op());
            const child7 = atom<Op>(atomId(2, 6), child5.id, new Op());
            const child8 = atom<Op>(atomId(2, 7), child7.id, new Op());

            second.insertMany(root, child1, child4, child5, child7, child8);

            const firstRefs = first.atoms;
            const secondRefs = second.atoms;

            let newWeave = new Weave<Op>();
            newWeave.import(firstRefs);

            // Note that the partial weave must contain a complete causal chain.
            // That is, every parent node to the leafs
            newWeave.import(secondRefs);

            const atoms = newWeave.atoms.map(a => a.atom);
            expect(atoms[0]).toEqual(root);
            expect(atoms[1]).toEqual(child4);
            expect(atoms[2]).toEqual(child2);
            expect(atoms[3]).toEqual(child6);
            expect(atoms[4]).toEqual(child9);
            expect(atoms[5]).toEqual(child1);
            expect(atoms[6]).toEqual(child5);
            expect(atoms[7]).toEqual(child7);
            expect(atoms[8]).toEqual(child8);
            expect(atoms[9]).toEqual(child3);
            expect(atoms.length).toBe(10);
        });

        it('should keep the yarn updated', () => {
            let first = new Weave<Op>();

            const root = atom<Op>(atomId(1, 0), null, new Op());
            const child1 = atom<Op>(atomId(1, 1), root.id, new Op());
            const child2 = atom<Op>(atomId(1, 2), root.id, new Op());
            const child3 = atom<Op>(atomId(1, 3), child1.id, new Op());
            const child6 = atom<Op>(atomId(1, 6), child2.id, new Op());
            const child9 = atom<Op>(atomId(1, 7), child6.id, new Op());

            first.insertMany(root, child1, child2, child3, child6, child9);

            let second = new Weave<Op>();

            const child4 = atom<Op>(atomId(2, 4), root.id, new Op());
            const child5 = atom<Op>(atomId(2, 5), child1.id, new Op());
            const child7 = atom<Op>(atomId(2, 6), child5.id, new Op());
            const child8 = atom<Op>(atomId(2, 7), child7.id, new Op());

            second.insertMany(root, child1, child4, child5, child7, child8);

            const firstRefs = first.atoms;
            const secondRefs = second.atoms;

            let newWeave = new Weave<Op>();
            newWeave.import(firstRefs);

            // Note that the partial weave must contain a complete causal chain.
            // That is, every parent node to the leafs
            newWeave.import(secondRefs);

            const atoms = newWeave.atoms.map(a => a.atom);

            const site1 = newWeave.getSite(1);
            expect(site1.get(0).atom).toEqual(root);
            expect(site1.get(1).atom).toEqual(child1);
            expect(site1.get(2).atom).toEqual(child2);
            expect(site1.get(3).atom).toEqual(child3);
            expect(site1.get(4).atom).toEqual(child6);
            expect(site1.get(5).atom).toEqual(child9);
            expect(site1.length).toBe(6);

            const site2 = newWeave.getSite(2);
            expect(site2.get(0).atom).toEqual(child4);
            expect(site2.get(1).atom).toEqual(child5);
            expect(site2.get(2).atom).toEqual(child7);
            expect(site2.get(3).atom).toEqual(child8);
            expect(site2.length).toBe(4);
        });

    });

});