///<reference path="World.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Astar.ts"/>
///<reference path="Heuristics.ts"/>

module Planner {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

    export function plan(interpretations : Interpreter.Result[], currentState : WorldState) : Result[] {

        var plans : Result[] = [];
        interpretations.forEach((intprt) => {
            var plan : Result = <Result>intprt;
            plan.plan = planInterpretation(plan.intp, currentState);
            plans.push(plan);
        });

        if (plans.length) {
            return plans;
        } else {
            throw new Planner.Error("Found no plans");
        }
    }


    export interface Result extends Interpreter.Result {plan:string[];}


    export function planToString(res : Result) : string {
        return res.plan.join(", ");
    }


    export class Error implements Error {
        public name = "Planner.Error";
        constructor(public message? : string) {}
        public toString() {return this.name + ": " + this.message}
    }


    //////////////////////////////////////////////////////////////////////
    // private functions

    var worldDictionary : {[s:string] : ObjectDefinition} = null;

    function planInterpretation(intprt : Interpreter.Literal[][], state : WorldState) : string[] {

        worldDictionary = state.objects;

        var goal = computeGoalFunction(intprt);
        var heur = Heuristics.computeHeuristicFunction(intprt);
        var start = new Heuristics.State(state.arm, state.holding, state.stacks);

        var plan : string[] = Astar.astar(neighbours, cost, heur, start, goal, true, 10000);
        plan.shift();

        console.log("This plan has " + plan.length + " elements...");

        return plan;
    }

    function cost(a : Heuristics.State, b : Heuristics.State) : number{
        return 1;
    }

    /**
    * @return goal function for Astar.
    */
    function computeGoalFunction(intprt : Interpreter.Literal[][]) : Astar.Goal<Heuristics.State>{
        return (s : Heuristics.State) => {
            for(var ix in intprt){
                if(testConjunctiveClause(s, intprt[ix])){
                    return true;
                }
            }
            // None of them is true
            return false;
        };
    }

    function testConjunctiveClause(s : Heuristics.State, c : Interpreter.Literal[]) : boolean{
        for(var ix in c){
            if(! testAtom(s, c[ix])){
                return false;
            }
        }
        // They are all true
        return true;
    }

    /**
    * Returns negative value if in different stacks.
    * Otherwise, returns the number of objects in between.
    * Is negative if b is above a.
    */
    function heightDifference(s : Heuristics.State, above : String, below : String) : number {
        var a = Heuristics.computeObjectPosition(s, above);
        var b = Heuristics.computeObjectPosition(s, below);
        if(b.isHeld || a.isHeld){
            return -1;
        }

        if(a.isFloor){
            throw new Planner.Error("heightDiff: Floor cannot be above anything... "+
                                    "Should never happen.");
        }

        if(b.isFloor){
            // Dont touch this line!!! Becomes string concatenation otherwise...
            return (+a.heightNo) + 1;
        }

        if(a.stackNo == b.stackNo){
            return a.heightNo - b.heightNo;
        }

        return -1;
    }

    function testAtom(s : Heuristics.State, atom : Interpreter.Literal) : boolean {
        var ret = (result => {
            if(atom.pol){
                return result;
            }
            return ! result;
        })

        var result : boolean;

        switch(atom.rel){
            case "holding":
                return ret(s.holding === atom.args[0]);
            case "inside": // Same as ontop.
            case "ontop":
                var above = atom.args[0];
                var below = atom.args[1];
                return ret( heightDifference(s, above, below) === 1 );

            case "above":   // Also incorporates "under"
                var above = atom.args[0];
                var below = atom.args[1];
                return ret( heightDifference(s, above, below) > 0 );

            default:
                throw new Planner.Error("!!! Unimplemented relation in testAtom: "+atom.rel);
                return true;
        }
        console.log("OOPS? testAtom: Default return for relation "+atom.rel);
        return ret(false);
    }

    function neighbours(s : Heuristics.State) : Astar.Neighb<Heuristics.State>[]{
        var result = [];
        var numStacks = s.stacks.length;

        if(s.arm > 0){
            // Can move left
            result.push(performAction("l",s));
        }
        if(s.arm < numStacks-1){
            // Can move right
            result.push(performAction("r",s));
        }

        if(s.holding == null){
            if(s.stacks[s.arm].length>0){
                // Can pick up
                result.push(performAction("p",s));
            }
        } else {
            var currStack = s.stacks[s.arm];
            if(currStack.length > 0){
                var head : string = currStack[currStack.length-1];
                if(canSupport(s.holding, head)){

                    // Can drop here
                    result.push(performAction("d",s));
                }
            } else {
                // Floor
                result.push(performAction("d",s));
            }
        }

        return result;
    }

    function performAction(action: string, state: Heuristics.State) : Astar.Neighb<Heuristics.State>{
        var newState = cloneState(state);

        switch(action){
            case "l":
                newState.arm = state.arm - 1;
                break;
            case "r":
                newState.arm = state.arm + 1;
                break;
            case "p":
                newState.holding = newState.stacks[newState.arm].pop();
                break;
            case "d":
                newState.stacks[newState.arm].push(newState.holding);
                newState.holding = null;
                break;
            default:
                throw new Planner.Error("ERROR: unknown action "+action);
                return undefined;
        }
        return {state: newState, action: action};
    }

    function canSupport(above: string, below: string) : boolean{
        var objA : ObjectDefinition = worldDictionary[above];
        var objB : ObjectDefinition = worldDictionary[below];

        return Interpreter.canSupport(objA, objB);
    }

//////////////////////////////////////////////////////////////////////
// Basic helper functions

    function isUndefined(a){
        return typeof a === 'undefined' ;
    }

    function cloneState(s : Heuristics.State) : Heuristics.State{
        var rs = [];
        for(var i in s.stacks){
            rs.push(s.stacks[i].slice());
        }
        return new Heuristics.State(s.arm, s.holding, rs);
    }

    function getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }

}
