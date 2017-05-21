(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Fraction = require('./src/fractions');
var Expression = require('./src/expressions').Expression;
var Equation = require('./src/equations');
var Parser = require('./src/parser');


var parse = function(input){
	var parser = new Parser();
	var result = parser.parse(input);
	return result;
};

var toTex = function(input) {
    if (input instanceof Fraction || input instanceof Expression || input instanceof Equation) {
        return input.toTex();
    } else if (input instanceof Array) {
        return input.map(
            function(e) {
                if (e instanceof Fraction) {
                    return e.toTex();
                } else {
                    return e.toString();
                }
            }
        ).join();
    } else {
        return input.toString();
    }
};

module.exports = {
    Fraction: Fraction,
    Expression: Expression,
    Equation: Equation,
    parse: parse,
    toTex: toTex
};

},{"./src/equations":2,"./src/expressions":3,"./src/fractions":4,"./src/parser":7}],2:[function(require,module,exports){
var Expression = require('./expressions').Expression;
var Variable = require('./expressions').Variable;
var Term = require('./expressions').Term;
var Fraction = require('./fractions');
var isInt = require('./helper').isInt;

var Equation = function(lhs, rhs) {
    if (lhs instanceof Expression) {
        this.lhs = lhs;

        if (rhs instanceof Expression) {
            this.rhs = rhs;
        } else if (rhs instanceof Fraction || isInt(rhs)) {
            this.rhs = new Expression(rhs);
        } else {
            throw new TypeError("Invalid Argument (" + rhs.toString() + "): Right-hand side must be of type Expression, Fraction or Integer.");
        }
    } else {
        throw new TypeError("Invalid Argument (" + lhs.toString() + "): Left-hand side must be of type Expression.");
    }
};

Equation.prototype.solveFor = function(variable) {
    if (!this.lhs._hasVariable(variable) && !this.rhs._hasVariable(variable)) {
        throw new TypeError("Invalid Argument (" + variable.toString() + "): Variable does not exist in the equation.");
    }

    // If the equation is linear and the variable in question can be isolated through arithmetic, solve.
    if (this._isLinear() || this._variableCanBeIsolated(variable)) {
        var solvingFor = new Term(new Variable(variable));
        var newLhs = new Expression();
        var newRhs = new Expression();

        for (var i = 0; i < this.rhs.terms.length; i++) {
            var term = this.rhs.terms[i];

            if (term.canBeCombinedWith(solvingFor)) {
                newLhs = newLhs.subtract(term);
            } else {
                newRhs = newRhs.add(term);
            }
        }

        for (var i = 0; i < this.lhs.terms.length; i++) {
            var term = this.lhs.terms[i];

            if (term.canBeCombinedWith(solvingFor)) {
                newLhs = newLhs.add(term);
            } else {
                newRhs = newRhs.subtract(term);
            }
        }

        newRhs = newRhs.subtract(this.lhs.constant());
        newRhs = newRhs.add(this.rhs.constant());

        if (newLhs.terms.length === 0) {
            if (newLhs.constant().equalTo(newRhs.constant())) {
                return new Fraction(1, 1);
            } else {
                throw new EvalError("No Solution");
            }
        }

        newRhs = newRhs.divide(newLhs.terms[0].coefficient());

        if (newRhs.terms.length === 0) {
            return newRhs.constant().reduce();
        }

        newRhs._sort();
        return newRhs;

    // Otherwise, move everything to the LHS.
    } else {
        var newLhs = this.lhs.copy();
        newLhs = newLhs.subtract(this.rhs);

        // If there are no terms left after this rearrangement and the constant is 0, there are infinite solutions.
        // Otherwise, there are no solutions.
        if (newLhs.terms.length === 0) {
            if (newLhs.constant().valueOf() === 0) {
                return [new Fraction(1, 1)];
            } else {
                throw new EvalError("No Solution");
            }

        // Otherwise, check degree and solve.
        } else if (this._isQuadratic(variable)) {
            var coefs = newLhs._quadraticCoefficients();

            var a = coefs.a;
            var b = coefs.b;
            var c = coefs.c;

            // Calculate the discriminant, b^2 - 4ac.
            var discriminant = b.pow(2).subtract(a.multiply(c).multiply(4));

            // If the discriminant is greater than or equal to 0, there is at least one real root.
            if (discriminant.valueOf() >= 0) {
                // If the discriminant is equal to 0, there is one real root: -b / 2a.
                if (discriminant.valueOf() === 0) {
                    return [b.multiply(-1).divide(a.multiply(2)).reduce()];

                    // If the discriminant is greater than 0, there are two real roots:
                    // (-b - √discriminant) / 2a
                    // (-b + √discriminant) / 2a
                } else {
                    var squareRootDiscriminant;

                    // If the answers will be rational, return reduced Fraction objects.
                    if (discriminant._squareRootIsRational()) {
                        squareRootDiscriminant = discriminant.pow(0.5);
                        var root1 = b.multiply(-1).subtract(squareRootDiscriminant).divide(a.multiply(2));
                        var root2 = b.multiply(-1).add(squareRootDiscriminant).divide(a.multiply(2));
                        return [root1.reduce(), root2.reduce()];
                        // If the answers will be irrational, return numbers.
                    } else {
                        squareRootDiscriminant = Math.sqrt(discriminant.valueOf());
                        a = a.valueOf();
                        b = b.valueOf();

                        var root1 = (-b - squareRootDiscriminant) / (2*a);
                        var root2 = (-b + squareRootDiscriminant) / (2*a);
                        return [root1, root2];
                    }
                }
                // If the discriminant is negative, there are no real roots.
            } else {
                return [];
            }
        } else if (this._isCubic(variable)) {
            var coefs = newLhs._cubicCoefficients();

            var a = coefs.a;
            var b = coefs.b;
            var c = coefs.c;
            var d = coefs.d;

            // Calculate D and D0.
            var D = a.multiply(b).multiply(c).multiply(d).multiply(18);
            D = D.subtract(b.pow(3).multiply(d).multiply(4));
            D = D.add(b.pow(2).multiply(c.pow(2)));
            D = D.subtract(a.multiply(c.pow(3)).multiply(4));
            D = D.subtract(a.pow(2).multiply(d.pow(2)).multiply(27));

            var D0 = b.pow(2).subtract(a.multiply(c).multiply(3));

            // Check for special cases when D = 0.
            
            if (D.valueOf() === 0) {
            
                // If D = D0 = 0, there is one distinct real root, -b / 3a.
                if (D0.valueOf() === 0) {
                    var root1 = b.multiply(-1).divide(a.multiply(3));

                    return [root1.reduce()];
                    // Otherwise, if D0 != 0, there are two distinct real roots.
                    // 9ad - bc / 2D0
                    // 4abc - 9a^2d - b^3 / aD0
                } else {
                    var root1 = a.multiply(b).multiply(c).multiply(4);
                    root1 = root1.subtract(a.pow(2).multiply(d).multiply(9));
                    root1 = root1.subtract(b.pow(3));
                    root1 = root1.divide(a.multiply(D0));

                    var root2 = a.multiply(d).multiply(9).subtract(b.multiply(c)).divide(D0.multiply(2));

                    return [root1.reduce(), root2.reduce()];
                }

                // Otherwise, use a different method for solving.
            } else {
               var f = ((3*(c/a)) - ((Math.pow(b, 2))/(Math.pow(a, 2))))/3;
               var g = (2*(Math.pow(b, 3))/(Math.pow(a, 3)));
               g = g - (9*b*c/(Math.pow(a, 2)));
               g = g + (27*d)/a;
               g = g/27;
               var h = (Math.pow(g, 2)/4) + (Math.pow(f, 3)/27);

               /*
               	if f = g = h = 0 then roots are equal (has been already taken care of!)
               	if h>0, only one real root
               	if h<=0, all three roots are real
               */
               
               if(h>0)
               {
               		
               		var R = -(g/2) + Math.sqrt(h);
               		var S = Math.cbrt(R);
               		var T = -(g/2) - Math.sqrt(h);
               		var U = Math.cbrt(T);
               		var root1 = (S+U) - (b/(3*a));
               		/* Round off the roots if the difference between absolute value of ceil and number is < e-15*/
               		if(root1<0)
               		{
               			var Croot1 = Math.floor(root1);
               			if(root1 - Croot1 < 1e-15)
               				root1 = Croot1;
               		}
               		else if(root1>0)
               		{
               			var Croot1 = Math.ceil(root1);
               			if(Croot1 - root1 < 1e-15)
               				root1 = Croot1;
               		}
               		
               		return [root1];	
               }
               else
               {
               		var i = Math.sqrt(((Math.pow(g, 2)/4) - h));
               		var j = Math.cbrt(i);
               		
               		var k = Math.acos(-(g/(2*i)));
               		var L = -j;
               		var M = Math.cos(k/3);
               		var N = Math.sqrt(3) * Math.sin(k/3);
               		var P = -(b/(3*a));
               		
               		var root1 = 2*j*Math.cos(k/3) - (b/(3*a));
               		var root2 = L*(M+N) + P;
               		var root3 = L*(M-N) + P;
               		
               		
               		/* Round off the roots if the difference between absolute value of ceil and number is < e-15*/
               		if(root1<0)
               		{
               			var Croot1 = Math.floor(root1);
               			if(root1 - Croot1 < 1e-15)
               				root1 = Croot1;
               		}
               		else if(root1>0)
               		{
               			var Croot1 = Math.ceil(root1);
               			if(Croot1 - root1 < 1e-15)
               				root1 = Croot1;
               		}
               		
               		if(root2<0)
               		{
               			var Croot2 = Math.floor(root2);
               			if(root2 - Croot2 < 1e-15)
               				root2 = Croot2;
               		}
               		else if(root2>0)
               		{
               			var Croot2 = Math.ceil(root2);
               			if(Croot2 - root2 < 1e-15)
               				root2 = Croot2;
               		}
               		
               		if(root1<0)
               		{
               			var Croot3 = Math.floor(root3);
               			if(root3 - Croot3 < 1e-15)
               				root3 = Croot3;
               		}
               		else if(root3>0)
               		{
               			var Croot3 = Math.ceil(root3);
               			if(Croot3 - root3 < 1e-15)
               				root3 = Croot3;
               		}
               		
               		var roots = [root1, root2, root3];
               		roots.sort(function(a, b){return a-b;});	// roots in ascending order
               		
               		return [roots[0], roots[1], roots[2]];
               
               }
               
            }
        }
    }
};

Equation.prototype.eval = function(values) {
    return new Equation(this.lhs.eval(values), this.rhs.eval(values));
};

Equation.prototype.toString = function() {
    return this.lhs.toString() + " = " + this.rhs.toString();
};

Equation.prototype.toTex = function() {
    return this.lhs.toTex() + " = " + this.rhs.toTex();
};

Equation.prototype._maxDegree = function() {
    var lhsMax = this.lhs._maxDegree();
    var rhsMax = this.rhs._maxDegree();
    return Math.max(lhsMax, rhsMax);
};

Equation.prototype._maxDegreeOfVariable = function(variable) {
    return Math.max(this.lhs._maxDegreeOfVariable(variable), this.rhs._maxDegreeOfVariable(variable));
};

Equation.prototype._variableCanBeIsolated = function(variable) {
    return this._maxDegreeOfVariable(variable) === 1 && this._noCrossProductsWithVariable(variable);
};

Equation.prototype._noCrossProductsWithVariable = function(variable) {
    return this.lhs._noCrossProductsWithVariable(variable) && this.rhs._noCrossProductsWithVariable(variable);
};

Equation.prototype._noCrossProducts = function() {
    return this.lhs._noCrossProducts() && this.rhs._noCrossProducts();
};

Equation.prototype._onlyHasVariable = function(variable) {
    return this.lhs._onlyHasVariable(variable) && this.rhs._onlyHasVariable(variable);
};

Equation.prototype._isLinear = function() {
    return this._maxDegree() === 1 && this._noCrossProducts();
};

Equation.prototype._isQuadratic = function(variable) {
    return this._maxDegree() === 2 && this._onlyHasVariable(variable);
};

Equation.prototype._isCubic = function(variable) {
    return this._maxDegree() === 3 && this._onlyHasVariable(variable);
};

module.exports = Equation;

},{"./expressions":3,"./fractions":4,"./helper":5}],3:[function(require,module,exports){
var Fraction = require('./fractions');
var isInt = require('./helper').isInt;
var GREEK_LETTERS = require('./helper').GREEK_LETTERS;

var Expression = function(variable) {
    this.constants = [];

    if(typeof(variable) === "string") {
        var v = new Variable(variable);
        var t = new Term(v);
        this.terms = [t];
    } else if(isInt(variable)) {
        this.constants = [new Fraction(variable, 1)];
        this.terms = [];
    } else if(variable instanceof Fraction) {
        this.constants = [variable];
        this.terms = [];
    } else if(variable instanceof Term) {
        this.terms = [variable];
    } else if(typeof(variable) === "undefined") {
        this.terms = [];
    }else{
        throw new TypeError("Invalid Argument (" + variable.toString() + "): Argument must be of type String, Integer, Fraction or Term.");
    }
};

Expression.prototype.constant = function() {
    return this.constants.reduce(function(p,c){return p.add(c);},new Fraction(0, 1));
};

Expression.prototype.simplify = function() {
    var copy = this.copy();

    //simplify all terms
    copy.terms = copy.terms.map(function(t){return t.simplify();});

    copy._sort();
    copy._combineLikeTerms();
    copy._moveTermsWithDegreeZeroToConstants();
    copy._removeTermsWithCoefficientZero();
    copy.constants = (copy.constant().valueOf() === 0 ? [] : [copy.constant()]);

    return copy;
};

Expression.prototype.copy = function() {
    var copy = new Expression();
    
    //copy all constants
    copy.constants = this.constants.map(function(c){return c.copy();});
    //copy all terms
    copy.terms = this.terms.map(function(t){return t.copy();});

    return copy;
};

Expression.prototype.add = function(a, simplify) {
    var thisExp = this.copy();

    if (typeof(a) === "string" || a instanceof Term || isInt(a) || a instanceof Fraction) {
        var exp = new Expression(a);
        return thisExp.add(exp, simplify);
    } else if (a instanceof Expression) {
        var keepTerms = a.copy().terms;

        thisExp.terms = thisExp.terms.concat(keepTerms);
        thisExp.constants = thisExp.constants.concat(a.constants);
        thisExp._sort();
    } else {
        throw new TypeError("Invalid Argument (" + a.toString() + "): Summand must be of type String, Expression, Term, Fraction or Integer.");
    }

    return (simplify || simplify === undefined) ? thisExp.simplify() : thisExp;
};

Expression.prototype.subtract = function(a, simplify) {
    var negative = (a instanceof Expression) ? a.multiply(-1) : new Expression(a).multiply(-1);
    return this.add(negative, simplify);
};

Expression.prototype.multiply = function(a, simplify) {
    var thisExp = this.copy();

    if (typeof(a) === "string" || a instanceof Term || isInt(a) || a instanceof Fraction) {
        var exp = new Expression(a);
        return thisExp.multiply(exp, simplify);
    } else if (a instanceof Expression) {
        var thatExp = a.copy();
        var newTerms = [];

        for (var i = 0; i < thisExp.terms.length; i++) {
            var thisTerm = thisExp.terms[i];

            for (var j = 0; j < thatExp.terms.length; j++) {
                var thatTerm = thatExp.terms[j];
                newTerms.push(thisTerm.multiply(thatTerm, simplify));
            }

            for (var j = 0; j < thatExp.constants.length; j++) {
                newTerms.push(thisTerm.multiply(thatExp.constants[j], simplify));
            }
        }

        for (var i = 0; i < thatExp.terms.length; i++) {
            var thatTerm = thatExp.terms[i];

            for (var j = 0; j < thisExp.constants.length; j++) {
                newTerms.push(thatTerm.multiply(thisExp.constants[j], simplify));
            }
        }

        var newConstants = [];

        for (var i = 0; i < thisExp.constants.length; i++) {
            var thisConst = thisExp.constants[i];

            for (var j = 0; j < thatExp.constants.length; j++) {
                var thatConst = thatExp.constants[j];
                var t = new Term();
                t = t.multiply(thatConst, false);
                t = t.multiply(thisConst, false);
                newTerms.push(t);
            }
        }

        thisExp.constants = newConstants;
        thisExp.terms = newTerms;
        thisExp._sort();
    } else {
        throw new TypeError("Invalid Argument (" + a.toString() + "): Multiplicand must be of type String, Expression, Term, Fraction or Integer.");
    }

    return (simplify || simplify === undefined) ? thisExp.simplify() : thisExp;
};

Expression.prototype.divide = function(a, simplify) {
    if (a instanceof Fraction || isInt(a)) {

        if (a.valueOf() === 0) {
            throw new EvalError("Divide By Zero");
        }

        var copy = this.copy();

        for (var i = 0; i < copy.terms.length; i++) {
            var thisTerm = copy.terms[i];

            for (var j = 0; j < thisTerm.coefficients.length; j++) {
                thisTerm.coefficients[j] = thisTerm.coefficients[j].divide(a, simplify);
            }
        }

        //divide every constant by a
        copy.constants = copy.constants.map(function(c){return c.divide(a,simplify);});

        return copy;
    } else {
        throw new TypeError("Invalid Argument (" + a.toString() + "): Divisor must be of type Fraction or Integer.");
    }
};

Expression.prototype.pow = function(a, simplify) {
    if (isInt(a)) {
        var copy = this.copy();

        if (a === 0) {
            return new Expression().add(1);
        } else {
            for (var i = 1; i < a; i++) {
                copy = copy.multiply(this, simplify);
            }

            copy._sort();
        }

        return (simplify || simplify === undefined) ? copy.simplify() : copy;
    } else {
        throw new TypeError("Invalid Argument (" + a.toString() + "): Exponent must be of type Integer.");
    }
};

Expression.prototype.eval = function(values, simplify) {
    var exp = new Expression();
    exp.constants = (simplify ? [this.constant()] : this.constants.slice());

    //add all evaluated terms of this to exp
    exp = this.terms.reduce(function(p,c){return p.add(c.eval(values,simplify),simplify);},exp);

    return exp;
};

Expression.prototype.summation = function(variable, lower, upper, simplify) {
	var thisExpr = this.copy();
	var newExpr = new Expression();
	for(var i = lower; i < (upper + 1); i++) {
		var sub = {};
		sub[variable] = i;
		newExpr = newExpr.add(thisExpr.eval(sub, simplify), simplify);
	}
	return newExpr;
};

Expression.prototype.toString = function() {
    var str = "";

    for (var i = 0; i < this.terms.length; i++) {
        var term = this.terms[i];

        str += (term.coefficients[0].valueOf() < 0 ? " - " : " + ") + term.toString();
    }

    for (var i = 0; i < this.constants.length; i++) {
        var constant = this.constants[i];

        str += (constant.valueOf() < 0 ? " - " : " + ") + constant.abs().toString();
    }

    if (str.substring(0, 3) === " - ") {
        return "-" + str.substring(3, str.length);
    } else if (str.substring(0, 3) === " + ") {
        return str.substring(3, str.length);
    } else {
        return "0";
    }
};

Expression.prototype.toTex = function(dict) {
    var str = "";

    for (var i = 0; i < this.terms.length; i++) {
        var term = this.terms[i];

        str += (term.coefficients[0].valueOf() < 0 ? " - " : " + ") + term.toTex(dict);
    }

    for (var i = 0; i < this.constants.length; i++) {
        var constant = this.constants[i];

        str += (constant.valueOf() < 0 ? " - " : " + ") + constant.abs().toTex();
    }

    if (str.substring(0, 3) === " - ") {
        return "-" + str.substring(3, str.length);
    } else if (str.substring(0, 3) === " + ") {
        return str.substring(3, str.length);
    } else {
        return "0";
    }
};

Expression.prototype._removeTermsWithCoefficientZero = function() {
    this.terms = this.terms.filter(function(t){return t.coefficient().reduce().numer !== 0;});
    return this;
};

Expression.prototype._combineLikeTerms = function() {
    function alreadyEncountered(term, encountered) {
        for (var i = 0; i < encountered.length; i++) {
            if (term.canBeCombinedWith(encountered[i])) {
                return true;
            }
        }

        return false;
    }

    var newTerms = [];
    var encountered = [];

    for (var i = 0; i < this.terms.length; i++) {
        var thisTerm = this.terms[i];

        if (alreadyEncountered(thisTerm, encountered)) {
            continue;
        } else {
            for (var j = i + 1; j < this.terms.length; j++) {
                var thatTerm = this.terms[j];

                if (thisTerm.canBeCombinedWith(thatTerm)) {
                    thisTerm = thisTerm.add(thatTerm);
                }
            }

            newTerms.push(thisTerm);
            encountered.push(thisTerm);
        }

    }

    this.terms = newTerms;
    return this;
};

Expression.prototype._moveTermsWithDegreeZeroToConstants = function() {
    var keepTerms = [];
    var constant = new Fraction(0, 1);

    for (var i = 0; i < this.terms.length; i++) {
        var thisTerm = this.terms[i];

        if (thisTerm.variables.length === 0) {
            constant = constant.add(thisTerm.coefficient());
        } else {
            keepTerms.push(thisTerm);
        }
    }

    this.constants.push(constant);
    this.terms = keepTerms;
    return this;
};

Expression.prototype._sort = function() {
    function sortTerms(a, b) {
        var x = a.maxDegree();
        var y = b.maxDegree();

        if (x === y) {
            var m = a.variables.length;
            var n = b.variables.length;

            return n - m;
        } else {
            return y - x;
        }
    }

    this.terms = this.terms.sort(sortTerms);
    return this;
};

Expression.prototype._hasVariable = function(variable) {
    for (var i = 0; i < this.terms.length; i++) {
        if (this.terms[i].hasVariable(variable)) {
            return true;
        }
    }

    return false;
};

Expression.prototype._onlyHasVariable = function(variable) {
    for (var i = 0; i < this.terms.length; i++) {
        if (!this.terms[i].onlyHasVariable(variable)) {
            return false;
        }
    }

    return true;
};

Expression.prototype._noCrossProductsWithVariable = function(variable) {
    for (var i = 0; i < this.terms.length; i++) {
        var term = this.terms[i];
        if (term.hasVariable(variable)  && !term.onlyHasVariable(variable)) {
            return false;
        }
    }

    return true;
};

Expression.prototype._noCrossProducts = function() {
    for (var i = 0; i < this.terms.length; i++) {
        var term = this.terms[i];
        if (term.variables.length > 1) {
            return false;
        }
    }

    return true;
};

Expression.prototype._maxDegree = function() {
    return this.terms.reduce(function(p,c){return Math.max(p,c.maxDegree());},1);
};

Expression.prototype._maxDegreeOfVariable = function(variable) {
    return this.terms.reduce(function(p,c){return Math.max(p,c.maxDegreeOfVariable(variable));},1);
};

Expression.prototype._quadraticCoefficients = function() {
    // This function isn't used until everything has been moved to the LHS in Equation.solve.
    var a;
    var b = new Fraction(0, 1);
    for (var i = 0; i < this.terms.length; i++) {
        var thisTerm = this.terms[i];
        a = (thisTerm.maxDegree() === 2) ? thisTerm.coefficient().copy() : a;
        b = (thisTerm.maxDegree() === 1) ? thisTerm.coefficient().copy() : b;
    }
    var c = this.constant();

    return {a:a, b:b, c:c};
};

Expression.prototype._cubicCoefficients = function() {
    // This function isn't used until everything has been moved to the LHS in Equation.solve.
    var a;
    var b = new Fraction(0, 1);
    var c = new Fraction(0, 1);

    for (var i = 0; i < this.terms.length; i++) {
        var thisTerm = this.terms[i];
        a = (thisTerm.maxDegree() === 3) ? thisTerm.coefficient().copy() : a;
        b = (thisTerm.maxDegree() === 2) ? thisTerm.coefficient().copy() : b;
        c = (thisTerm.maxDegree() === 1) ? thisTerm.coefficient().copy() : c;
    }

    var d = this.constant();
    return {a:a, b:b, c:c, d:d};
};

Term = function(variable) {
    if (variable instanceof Variable) {
        this.variables = [variable.copy()];
    } else if (typeof(variable) === "undefined") {
        this.variables = [];
    } else {
        throw new TypeError("Invalid Argument (" + variable.toString() + "): Term initializer must be of type Variable.");
    }

    this.coefficients = [new Fraction(1, 1)];
};

Term.prototype.coefficient = function() {
    //calculate the product of all coefficients
    return this.coefficients.reduce(function(p,c){return p.multiply(c);}, new Fraction(1,1));
};

Term.prototype.simplify = function() {
    var copy = this.copy();
    copy.coefficients = [this.coefficient()];
    copy.combineVars();
    return copy.sort();
};

Term.prototype.combineVars = function() {
    var uniqueVars = {};

    for (var i = 0; i < this.variables.length; i++) {
        var thisVar = this.variables[i];

        if (thisVar.variable in uniqueVars) {
            uniqueVars[thisVar.variable] += thisVar.degree;
        } else {
            uniqueVars[thisVar.variable] = thisVar.degree;
        }
    }

    var newVars = [];

    for (var v in uniqueVars) {
        var newVar = new Variable(v);
        newVar.degree = uniqueVars[v];
        newVars.push(newVar);
    }

    this.variables = newVars;
    return this;
};

Term.prototype.copy = function() {
    var copy = new Term();
    copy.coefficients = this.coefficients.map(function(c){return c.copy();});
    copy.variables = this.variables.map(function(v){return v.copy();});
    return copy;
};

Term.prototype.add = function(term) {
    if(term instanceof Term && this.canBeCombinedWith(term)) {
        var copy = this.copy();
        copy.coefficients = [copy.coefficient().add(term.coefficient())];
        return copy;
    } else {
        throw new TypeError("Invalid Argument (" + term.toString() + "): Summand must be of type String, Expression, Term, Fraction or Integer.");
    }
};

Term.prototype.subtract = function(term) {
    if (term instanceof Term && this.canBeCombinedWith(term)) {
        var copy = this.copy();
        copy.coefficients = [copy.coefficient().subtract(term.coefficient())];
        return copy;
    } else {
        throw new TypeError("Invalid Argument (" + term.toString() + "): Subtrahend must be of type String, Expression, Term, Fraction or Integer.");
    }
};

Term.prototype.multiply = function(a, simplify) {
    var thisTerm = this.copy();

    if (a instanceof Term) {
        thisTerm.variables = thisTerm.variables.concat(a.variables);
        thisTerm.coefficients = a.coefficients.concat(thisTerm.coefficients);

    } else if (isInt(a) || a instanceof Fraction) {
        var newCoef = (isInt(a) ? new Fraction(a, 1) : a);

        if (thisTerm.variables.length === 0) {
            thisTerm.coefficients.push(newCoef);
        } else {
            thisTerm.coefficients.unshift(newCoef);
        }
    } else {
        throw new TypeError("Invalid Argument (" + a.toString() + "): Multiplicand must be of type String, Expression, Term, Fraction or Integer.");
    }

    return (simplify || simplify === undefined) ? thisTerm.simplify() : thisTerm;
};

Term.prototype.divide = function(a, simplify) {
    if(isInt(a) || a instanceof Fraction) {
        var thisTerm = this.copy();
        thisTerm.coefficients = thisTerm.coefficients.map(function(c){return c.divide(a,simplify);});
        return thisTerm;
    } else {
        throw new TypeError("Invalid Argument (" + a.toString() + "): Argument must be of type Fraction or Integer.");
    }
};

Term.prototype.eval = function(values, simplify) {
    var copy = this.copy();
    var keys = Object.keys(values);
    var exp = copy.coefficients.reduce(function(p,c){return p.multiply(c,simplify);}, new Expression(1));

    for(var i = 0; i < copy.variables.length; i++) {
        var thisVar = copy.variables[i];

        var ev;

        if (thisVar.variable in values) {
            var sub = values[thisVar.variable];

            if(sub instanceof Fraction || sub instanceof Expression) {
                ev = sub.pow(thisVar.degree);
            } else if(isInt(sub)) {
                ev = Math.pow(sub, thisVar.degree);
            } else {
                throw new TypeError("Invalid Argument (" + sub + "): Can only evaluate Expressions or Fractions.");
            }
        } else {
            ev = new Expression(thisVar.variable).pow(thisVar.degree);
        }

        exp = exp.multiply(ev, simplify);
    }

    return exp;
};

Term.prototype.hasVariable = function(variable) {
    for (var i = 0; i < this.variables.length; i++) {
        if (this.variables[i].variable === variable) {
            return true;
        }
    }

    return false;
};

Term.prototype.maxDegree = function() {
    return this.variables.reduce(function(p,c){return Math.max(p,c.degree);},1);
};

Term.prototype.maxDegreeOfVariable = function(variable) {
    return this.variables.reduce(function(p,c){return (c.variable === variable) ? Math.max(p,c.degree) : p;},1);
};

Term.prototype.canBeCombinedWith = function(term) {
    var thisVars = this.variables;
    var thatVars = term.variables;

    if(thisVars.length != thatVars.length) {
        return false;
    }

    var matches = 0;

    for(var i = 0; i < thisVars.length; i++) {
        for(var j = 0; j < thatVars.length; j++) {
            if(thisVars[i].variable === thatVars[j].variable && thisVars[i].degree === thatVars[j].degree) {
                matches += 1;
            }
        }
    }

    return (matches === thisVars.length);
};

Term.prototype.onlyHasVariable = function(variable) {
    for (var i = 0; i < this.variables.length; i++) {
        if (this.variables[i].variable != variable) {
            return false;
        }
    }

    return true;
};

Term.prototype.sort = function() {
    function sortVars(a, b) {
        return b.degree - a.degree;
    }

    this.variables = this.variables.sort(sortVars);
    return this;
};

Term.prototype.toString = function() {
    var str = "";

    for (var i = 0; i < this.coefficients.length; i++) {
        var coef = this.coefficients[i];

        if (coef.abs().numer !== 1 || coef.abs().denom !== 1) {
            str += " * " + coef.toString();
        }
    }

    str = this.variables.reduce(function(p,c){return p.concat(c.toString());},str);
    str = (str.substring(0, 3) === " * " ? str.substring(3, str.length) : str);
    str = (str.substring(0, 1) === "-" ? str.substring(1, str.length) : str);

    return str;
};

Term.prototype.toTex = function(dict) {
    var dict = (dict === undefined) ? {} : dict;
    dict.multiplication = !("multiplication" in dict) ? "cdot" : dict.multiplication;
    
    var op =  " \\" + dict.multiplication + " ";

    var str = "";

    for (var i = 0; i < this.coefficients.length; i++) {
        var coef = this.coefficients[i];

        if (coef.abs().numer !== 1 || coef.abs().denom !== 1) {
            str += op + coef.toTex();
        }
    }
    str = this.variables.reduce(function(p,c){return p.concat(c.toTex());},str);
    str = (str.substring(0, op.length) === op ? str.substring(op.length, str.length) : str);
    str = (str.substring(0, 1) === "-" ? str.substring(1, str.length) : str);
    str = (str.substring(0, 7) === "\\frac{-" ? "\\frac{" + str.substring(7, str.length) : str);

    return str;
};

var Variable = function(variable) {
    if (typeof(variable) === "string") {
        this.variable = variable;
        this.degree = 1;
    } else {
        throw new TypeError("Invalid Argument (" + variable.toString() + "): Variable initalizer must be of type String.");
    }
};

Variable.prototype.copy = function() {
    var copy = new Variable(this.variable);
    copy.degree = this.degree;
    return copy;
};

Variable.prototype.toString = function() {
    var degree = this.degree;
    var variable = this.variable;

    if (degree === 0) {
        return "";
    } else if (degree === 1) {
        return variable;
    } else {
        return variable + "^" + degree;
    }
};

Variable.prototype.toTex = function() {
    var degree = this.degree;
    var variable = this.variable;

    if (GREEK_LETTERS.indexOf(variable) > -1) {
        variable = "\\" + variable;
    }

    if (degree === 0) {
        return "";
    } else if (degree === 1) {
        return variable;
    } else {
        return variable + "^{" + degree + "}";
    }
};

module.exports = {
    Expression: Expression,
    Term: Term,
    Variable: Variable
};
},{"./fractions":4,"./helper":5}],4:[function(require,module,exports){
var isInt = require('./helper').isInt;
var gcd = require('./helper').gcd;
var lcm = require('./helper').lcm;

var Fraction = function(a, b) {
    if (b === 0) {
        throw new EvalError("Divide By Zero");
    } else if (isInt(a) && isInt(b)) {
        this.numer = a;
        this.denom = b;
    } else {
        throw new TypeError("Invalid Argument ("+a.toString()+ ","+ b.toString() +"): Divisor and dividend must be of type Integer.");
    }
};

Fraction.prototype.copy = function() {
    return new Fraction(this.numer, this.denom);
};

Fraction.prototype.reduce = function() {
    var copy = this.copy();

    var g = gcd(copy.numer, copy.denom);
    copy.numer = copy.numer / g;
    copy.denom = copy.denom / g;

    if (Math.sign(copy.denom) == -1 && Math.sign(copy.numer) == 1) {
        copy.numer *= -1;
        copy.denom *= -1;
    }

    return copy;
};

Fraction.prototype.equalTo = function(fraction) {
    if(fraction instanceof Fraction) {
        var thisReduced = this.reduce();
        var thatReduced = fraction.reduce();
        return thisReduced.numer === thatReduced.numer && thisReduced.denom === thatReduced.denom;
    }else{
        return false;
    }
};

Fraction.prototype.add = function(f, simplify) {
    simplify = (simplify === undefined ? true : simplify);

    var a, b;

    if (f instanceof Fraction) {
        a = f.numer;
        b = f.denom;
    } else if (isInt(f)) {
        a = f;
        b = 1;
    } else {
        throw new TypeError("Invalid Argument (" + f.toString() + "): Summand must be of type Fraction or Integer.");
    }

    var copy = this.copy();

    if (this.denom == b) {
        copy.numer += a;
    } else {
        var m = lcm(copy.denom, b);
        var thisM = m / copy.denom;
        var otherM = m / b;

        copy.numer *= thisM;
        copy.denom *= thisM;

        a *= otherM;

        copy.numer += a;
    }

    return (simplify ? copy.reduce() : copy);
};

Fraction.prototype.subtract = function(f, simplify) {
    simplify = (simplify === undefined ? true : simplify);

    var copy = this.copy();

    if (f instanceof Fraction) {
        return copy.add(new Fraction(-f.numer, f.denom), simplify);
    } else if (isInt(f)) {
        return copy.add(new Fraction(-f, 1), simplify);
    } else {
        throw new TypeError("Invalid Argument (" + f.toString() + "): Subtrahend must be of type Fraction or Integer.");
    }
};

Fraction.prototype.multiply = function(f, simplify) {
    simplify = (simplify === undefined ? true : simplify);

    var a, b;

    if (f instanceof Fraction) {
        a = f.numer;
        b = f.denom;
    } else if (isInt(f) && f) {
        a = f;
        b = 1;
    } else if (f === 0) {
        a = 0;
        b = 1;
    } else {
        throw new TypeError("Invalid Argument (" + f.toString() + "): Multiplicand must be of type Fraction or Integer.");
    }

    var copy = this.copy();

    copy.numer *= a;
    copy.denom *= b;

    return (simplify ? copy.reduce() : copy);
};

Fraction.prototype.divide = function(f, simplify) {
    simplify = (simplify === undefined ? true : simplify);

    if (f.valueOf() === 0) {
        throw new EvalError("Divide By Zero");
    }

    var copy = this.copy();

    if (f instanceof Fraction) {
        return copy.multiply(new Fraction(f.denom, f.numer), simplify);
    } else if (isInt(f)) {
        return copy.multiply(new Fraction(1, f), simplify);
    } else {
        throw new TypeError("Invalid Argument (" + f.toString() + "): Divisor must be of type Fraction or Integer.");
    }
};

Fraction.prototype.pow = function(n, simplify) {
    simplify = (simplify === undefined ? true : simplify);

    var copy = this.copy();

    copy.numer = Math.pow(copy.numer, n);
    copy.denom = Math.pow(copy.denom, n);

    return (simplify ? copy.reduce() : copy);
};

Fraction.prototype.abs = function() {
    var copy = this.copy();

    copy.numer = Math.abs(copy.numer);
    copy.denom = Math.abs(copy.denom);

    return copy;
};

Fraction.prototype.valueOf = function() {
    return this.numer / this.denom;
};

Fraction.prototype.toString = function() {
    if (this.numer === 0) {
        return "0";
    } else if (this.denom === 1) {
        return this.numer.toString();
    } else if (this.denom === -1) {
        return (-this.numer).toString();
    } else {
        return this.numer + "/" + this.denom;
    }
};

Fraction.prototype.toTex = function() {
    if (this.numer === 0) {
        return "0";
    } else if (this.denom === 1) {
        return this.numer.toString();
    } else if (this.denom === -1) {
        return (-this.numer).toString();
    } else {
        return "\\frac{" + this.numer + "}{" + this.denom + "}";
    }
};

Fraction.prototype._squareRootIsRational = function() {
    if (this.valueOf() === 0) {
        return true;
    }

    var sqrtNumer = Math.sqrt(this.numer);
    var sqrtDenom = Math.sqrt(this.denom);

    return isInt(sqrtNumer) && isInt(sqrtDenom);
};

Fraction.prototype._cubeRootIsRational = function() {
    if (this.valueOf() === 0) {
        return true;
    }

    var cbrtNumer = Math.cbrt(this.numer);
    var cbrtDenom = Math.cbrt(this.denom);

    return isInt(cbrtNumer) && isInt(cbrtDenom);
};

module.exports = Fraction;
},{"./helper":5}],5:[function(require,module,exports){
function gcd(x, y) {
    while (y) {
        var temp = x;
        x = y;
        y = temp % y;
    }

    return x;
}

function lcm(x, y) {
    return (x * y) / gcd(x, y);
}

function isInt(thing) {
    return (typeof thing == "number") && (thing % 1 === 0);
}

function round(decimal, places) {
    places = (typeof(places) === "undefined" ? 2 : places);
    var x = Math.pow(10, places);
    return Math.round(parseFloat(decimal) * x) / x;
}

var GREEK_LETTERS = [
    'alpha',
    'beta',
    'gamma',
    'Gamma',
    'delta',
    'Delta',
    'epsilon',
    'varepsilon',
    'zeta',
    'eta',
    'theta',
    'vartheta',
    'Theta',
    'iota',
    'kappa',
    'lambda',
    'Lambda',
    'mu',
    'nu',
    'xi',
    'Xi',
    'pi',
    'Pi',
    'rho',
    'varrho',
    'sigma',
    'Sigma',
    'tau',
    'upsilon',
    'Upsilon',
    'phi',
    'varphi',
    'Phi',
    'chi',
    'psi',
    'Psi',
    'omega',
    'Omega'
];

exports.gcd = gcd;
exports.lcm = lcm;
exports.isInt = isInt;
exports.round = round;
exports.GREEK_LETTERS = GREEK_LETTERS;
},{}],6:[function(require,module,exports){
'use strict';

/*
  The lexer module is a slightly modified version of the handwritten lexer by Eli Bendersky.
  The parts not needed like comments and quotes were deleted and some things modified.
  Comments are left unchanged, the original lexer can be found here:
  http://eli.thegreenplace.net/2013/07/16/hand-written-lexer-in-javascript-compared-to-the-regex-based-ones
*/

var Lexer = function() {
  this.pos = 0;
  this.buf = null;
  this.buflen = 0;

  // Operator table, mapping operator -> token name
  this.optable = {
    '+':  'PLUS',
    '-':  'MINUS',
    '*':  'MULTIPLY',
    '/':  'DIVIDE',
    '^':  'POWER',
    '(':  'L_PAREN',
    ')':  'R_PAREN',
    '=':  'EQUALS'
  };
};

// Initialize the Lexer's buffer. This resets the lexer's internal
// state and subsequent tokens will be returned starting with the
// beginning of the new buffer.
Lexer.prototype.input = function(buf) {
  this.pos = 0;
  this.buf = buf;
  this.buflen = buf.length;
};

// Get the next token from the current buffer. A token is an object with
// the following properties:
// - type: name of the pattern that this token matched (taken from rules).
// - value: actual string value of the token.
// - pos: offset in the current buffer where the token starts.
//
// If there are no more tokens in the buffer, returns null. In case of
// an error throws Error.
Lexer.prototype.token = function() {
  this._skipnontokens();
  if (this.pos >= this.buflen) {
    return null;
  }

  // The char at this.pos is part of a real token. Figure out which.
  var c = this.buf.charAt(this.pos);
   // Look it up in the table of operators
  var op = this.optable[c];
  if (op !== undefined) {
    if(op === 'L_PAREN' || op === 'R_PAREN'){
       return {type: 'PAREN', value: op, pos: this.pos++};  
    }else{
      return {type: 'OPERATOR', value: op, pos: this.pos++};  
    }
  } else {
    // Not an operator - so it's the beginning of another token.
    if (Lexer._isalpha(c)) {
      return this._process_identifier();
    } else if (Lexer._isdigit(c)) {
      return this._process_number();
    } else {
      throw new SyntaxError('Token error at character ' + c + ' at position ' + this.pos);
    }
  }
};

Lexer._isdigit = function(c) {
  return c >= '0' && c <= '9';
};

Lexer._isalpha = function(c) {
  return (c >= 'a' && c <= 'z') ||
         (c >= 'A' && c <= 'Z');
};

Lexer._isalphanum = function(c) {
  return (c >= 'a' && c <= 'z') ||
         (c >= 'A' && c <= 'Z') ||
         (c >= '0' && c <= '9');
};

Lexer.prototype._process_digits = function(position){
  var endpos = position;
  while (endpos < this.buflen &&
        (Lexer._isdigit(this.buf.charAt(endpos)))){
    endpos++;
  }
  return endpos;
};

Lexer.prototype._process_number = function() {
  //Read characters until a non-digit character appears
  var endpos = this._process_digits(this.pos);
  //If it's a decimal point, continue to read digits
  if(this.buf.charAt(endpos) === '.'){
    endpos = this._process_digits(endpos + 1);
  }
  //Check if the last read character is a decimal point.
  //If it is, ignore it and proceed
  if(this.buf.charAt(endpos-1) === '.'){
    throw new SyntaxError("Decimal point without decimal digits at position " + (endpos-1));
  } 
  //construct the NUMBER token
  var tok = {
    type: 'NUMBER',
    value: this.buf.substring(this.pos, endpos),
    pos: this.pos
  };
  this.pos = endpos;
  return tok;
};

Lexer.prototype._process_identifier = function() {
  var endpos = this.pos + 1;
  while (endpos < this.buflen &&
         Lexer._isalphanum(this.buf.charAt(endpos))) {
    endpos++;
  }

  var tok = {
    type: 'IDENTIFIER',
    value: this.buf.substring(this.pos, endpos),
    pos: this.pos
  };
  this.pos = endpos;
  return tok;
};

Lexer.prototype._skipnontokens = function() {
  while (this.pos < this.buflen) {
    var c = this.buf.charAt(this.pos);
    if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
      this.pos++;
    } else {
      break;
    }
  }
};

module.exports = Lexer;

},{}],7:[function(require,module,exports){
'use strict';


var Lexer = require('./lexer'),
    Expression = require('./expressions').Expression,
    Fraction = require('./fractions'),
    Equation = require('./equations');

var Parser = function() {
    this.lexer = new Lexer();
    this.current_token = null;

    /**
     * Base-grammar:
     *
     * expr   -> expr + term
     *        | expr - term
     *        | - term
     *        | term
     *
     * term   -> term * factor
     *        | term factor
     *        | term / factor
     *        | term ^ factor
     *        | factor
     *
     * factor -> (expr)
     *        | num
     *        | id
     *
     * ===============================
     *
     * Grammar without left recursion -> the grammar actually used
     *
     * eqn         -> expr = expr
     * expr        -> term expr_rest
     * expr_rest   -> + term expr_rest
     *             | - term expr_rest
     *             | ε
     *
     * term        -> factor term_rest
     * term_rest   -> * term term_rest
     *             |   term term_rest
     *             | ^ term term_rest
     *             | / term term_rest
     *             | ε
     *
     * factor      -> (expr)
     *             | num
     *             | id
     *
     **/
};

// Updates the current token to the next input token 
Parser.prototype.update = function() {
    this.current_token = this.lexer.token();
};

// Returns true if the current token matches the keyword
Parser.prototype.match = function(keyword) {
    if (this.current_token === null) return keyword === 'epsilon';

    switch (keyword) {
        case 'plus':
            return ((this.current_token.type === 'OPERATOR') && (this.current_token.value === 'PLUS'));
        case 'minus':
            return ((this.current_token.type === 'OPERATOR') && (this.current_token.value === 'MINUS'));
        case 'multiply':
            return ((this.current_token.type === 'OPERATOR') && (this.current_token.value === 'MULTIPLY'));
        case 'power':
            return ((this.current_token.type === 'OPERATOR') && (this.current_token.value === 'POWER'));
        case 'divide':
            return ((this.current_token.type === 'OPERATOR') && (this.current_token.value === 'DIVIDE'));
        case 'equal':
            return ((this.current_token.type === 'OPERATOR') && (this.current_token.value === 'EQUALS'));
        case 'lparen':
            return ((this.current_token.type === 'PAREN') && (this.current_token.value === 'L_PAREN'));
        case 'rparen':
            return ((this.current_token.type === 'PAREN') && (this.current_token.value === 'R_PAREN'));
        case 'num':
            return (this.current_token.type === 'NUMBER');
        case 'id':
            return (this.current_token.type === 'IDENTIFIER');
        default:
            return false;
    }
};

/*
    Initializes the parser internals and the lexer.
    The input is then parsed according to the grammar described in the
    header comment. The parsing process constructs a abstract syntax tree
    using the classes the algebra.js library provides
*/
Parser.prototype.parse = function(input) {
    //pass the input to the lexer
    this.lexer.input(input);
    this.update();
    return this.parseEqn();
};

Parser.prototype.parseEqn = function() {
    var ex1 = this.parseExpr();
    if (this.match('equal')) {
        this.update();
        var ex2 = this.parseExpr();
        return new Equation(ex1,ex2);
    }else if(this.match('epsilon')){
        return ex1;
    }else{
        throw new SyntaxError('Unbalanced Parenthesis');
    }
};

Parser.prototype.parseExpr = function() {
    var term = this.parseTerm();
    return this.parseExprRest(term);
};

Parser.prototype.parseExprRest = function(term) {
    if (this.match('plus')) {
        this.update();
        var plusterm = this.parseTerm();
        if(term === undefined || plusterm === undefined) throw new SyntaxError('Missing operand');
        return this.parseExprRest(term.add(plusterm));
    } else if (this.match('minus')) {
        this.update();
        var minusterm = this.parseTerm();
        //This case is entered when a negative number is parsed e.g. x = -4
        if (term === undefined) {
            return this.parseExprRest(minusterm.multiply(-1));
        } else {
            return this.parseExprRest(term.subtract(minusterm));
        }
    } else {
        return term;
    }
};


Parser.prototype.parseTerm = function() {
    var factor = this.parseFactor();
    return this.parseTermRest(factor);
};

Parser.prototype.parseTermRest = function(factor) {
    if (this.match('multiply')) {
        this.update();
        var mulfactor = this.parseFactor();
        return factor.multiply(this.parseTermRest(mulfactor));
    } else if (this.match('power')) {
        this.update();
        var powfactor = this.parseFactor();
        //WORKAROUND: algebra.js only allows integers and fractions for raising
        return this.parseTermRest(factor.pow(parseInt(powfactor.toString())));
    } else if (this.match('divide')) {
        this.update();
        var devfactor = this.parseFactor();
        //WORKAROUND: algebra.js only allows integers and fractions for division
        return this.parseTermRest(factor.divide(this.convertToFraction(devfactor)));
    } else if (this.match('epsilon')) {
        return factor;
    } else {
        //a missing operator between terms is treated like a multiplier
        var mulfactor2 = this.parseFactor();
        if (mulfactor2 === undefined) {
            return factor;
        } else {
            return factor.multiply(this.parseTermRest(mulfactor2));
        }
    }
};

/**
 * Is used to convert expressions to fractions, as dividing by expressions is not possible
**/
Parser.prototype.convertToFraction = function(expression) {
    if(expression.terms.length > 0){
        throw new TypeError('Invalid Argument (' + expression.toString() + '): Divisor must be of type Integer or Fraction.');
    }else{
        var c = expression.constants[0];
        return new Fraction(c.numer, c.denom);
    }
};

Parser.prototype.parseFactor = function() {
    if (this.match('num')) {
        var num = this.parseNumber();
        this.update();
        return num;
    } else if (this.match('id')) {
        var id = new Expression(this.current_token.value);
        this.update();
        return id;
    } else if (this.match('lparen')) {
        this.update();
        var expr = this.parseExpr();
        if (this.match('rparen')) {
            this.update();
            return expr;
        } else {
            throw new SyntaxError('Unbalanced Parenthesis');
        }
    } else {
        return undefined;
    }
};

// Converts a number token - integer or decimal - to an expression
Parser.prototype.parseNumber = function() {
     //Integer conversion
    if(parseInt(this.current_token.value) == this.current_token.value){
        return new Expression(parseInt(this.current_token.value));      
    }else{
        //Split the decimal number to integer and decimal parts
        var splits = this.current_token.value.split('.');
        //count the digits of the decimal part
        var decimals = splits[1].length;
        //determine the multiplication factor
        var factor = Math.pow(10,decimals);
        var float_op = parseFloat(this.current_token.value);
        //multiply the float with the factor and divide it again afterwards 
        //to create a valid expression object
        return new Expression(parseInt(float_op * factor)).divide(factor);
    }
};

module.exports = Parser;

},{"./equations":2,"./expressions":3,"./fractions":4,"./lexer":6}],8:[function(require,module,exports){
var root = require('./_root');

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;

},{"./_root":15}],9:[function(require,module,exports){
var Symbol = require('./_Symbol'),
    getRawTag = require('./_getRawTag'),
    objectToString = require('./_objectToString');

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

module.exports = baseGetTag;

},{"./_Symbol":8,"./_getRawTag":12,"./_objectToString":13}],10:[function(require,module,exports){
(function (global){
/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

module.exports = freeGlobal;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],11:[function(require,module,exports){
var overArg = require('./_overArg');

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

module.exports = getPrototype;

},{"./_overArg":14}],12:[function(require,module,exports){
var Symbol = require('./_Symbol');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

module.exports = getRawTag;

},{"./_Symbol":8}],13:[function(require,module,exports){
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

module.exports = objectToString;

},{}],14:[function(require,module,exports){
/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;

},{}],15:[function(require,module,exports){
var freeGlobal = require('./_freeGlobal');

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;

},{"./_freeGlobal":10}],16:[function(require,module,exports){
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],17:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    getPrototype = require('./_getPrototype'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor &&
    funcToString.call(Ctor) == objectCtorString;
}

module.exports = isPlainObject;

},{"./_baseGetTag":9,"./_getPrototype":11,"./isObjectLike":16}],18:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],19:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports['default'] = applyMiddleware;

var _compose = require('./compose');

var _compose2 = _interopRequireDefault(_compose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
function applyMiddleware() {
  for (var _len = arguments.length, middlewares = Array(_len), _key = 0; _key < _len; _key++) {
    middlewares[_key] = arguments[_key];
  }

  return function (createStore) {
    return function (reducer, preloadedState, enhancer) {
      var store = createStore(reducer, preloadedState, enhancer);
      var _dispatch = store.dispatch;
      var chain = [];

      var middlewareAPI = {
        getState: store.getState,
        dispatch: function dispatch(action) {
          return _dispatch(action);
        }
      };
      chain = middlewares.map(function (middleware) {
        return middleware(middlewareAPI);
      });
      _dispatch = _compose2['default'].apply(undefined, chain)(store.dispatch);

      return _extends({}, store, {
        dispatch: _dispatch
      });
    };
  };
}
},{"./compose":22}],20:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = bindActionCreators;
function bindActionCreator(actionCreator, dispatch) {
  return function () {
    return dispatch(actionCreator.apply(undefined, arguments));
  };
}

/**
 * Turns an object whose values are action creators, into an object with the
 * same keys, but with every function wrapped into a `dispatch` call so they
 * may be invoked directly. This is just a convenience method, as you can call
 * `store.dispatch(MyActionCreators.doSomething())` yourself just fine.
 *
 * For convenience, you can also pass a single function as the first argument,
 * and get a function in return.
 *
 * @param {Function|Object} actionCreators An object whose values are action
 * creator functions. One handy way to obtain it is to use ES6 `import * as`
 * syntax. You may also pass a single function.
 *
 * @param {Function} dispatch The `dispatch` function available on your Redux
 * store.
 *
 * @returns {Function|Object} The object mimicking the original object, but with
 * every action creator wrapped into the `dispatch` call. If you passed a
 * function as `actionCreators`, the return value will also be a single
 * function.
 */
function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === 'function') {
    return bindActionCreator(actionCreators, dispatch);
  }

  if (typeof actionCreators !== 'object' || actionCreators === null) {
    throw new Error('bindActionCreators expected an object or a function, instead received ' + (actionCreators === null ? 'null' : typeof actionCreators) + '. ' + 'Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?');
  }

  var keys = Object.keys(actionCreators);
  var boundActionCreators = {};
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var actionCreator = actionCreators[key];
    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }
  return boundActionCreators;
}
},{}],21:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;
exports['default'] = combineReducers;

var _createStore = require('./createStore');

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _warning = require('./utils/warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function getUndefinedStateErrorMessage(key, action) {
  var actionType = action && action.type;
  var actionName = actionType && '"' + actionType.toString() + '"' || 'an action';

  return 'Given action ' + actionName + ', reducer "' + key + '" returned undefined. ' + 'To ignore an action, you must explicitly return the previous state.';
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) {
  var reducerKeys = Object.keys(reducers);
  var argumentName = action && action.type === _createStore.ActionTypes.INIT ? 'preloadedState argument passed to createStore' : 'previous state received by the reducer';

  if (reducerKeys.length === 0) {
    return 'Store does not have a valid reducer. Make sure the argument passed ' + 'to combineReducers is an object whose values are reducers.';
  }

  if (!(0, _isPlainObject2['default'])(inputState)) {
    return 'The ' + argumentName + ' has unexpected type of "' + {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] + '". Expected argument to be an object with the following ' + ('keys: "' + reducerKeys.join('", "') + '"');
  }

  var unexpectedKeys = Object.keys(inputState).filter(function (key) {
    return !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key];
  });

  unexpectedKeys.forEach(function (key) {
    unexpectedKeyCache[key] = true;
  });

  if (unexpectedKeys.length > 0) {
    return 'Unexpected ' + (unexpectedKeys.length > 1 ? 'keys' : 'key') + ' ' + ('"' + unexpectedKeys.join('", "') + '" found in ' + argumentName + '. ') + 'Expected to find one of the known reducer keys instead: ' + ('"' + reducerKeys.join('", "') + '". Unexpected keys will be ignored.');
  }
}

function assertReducerSanity(reducers) {
  Object.keys(reducers).forEach(function (key) {
    var reducer = reducers[key];
    var initialState = reducer(undefined, { type: _createStore.ActionTypes.INIT });

    if (typeof initialState === 'undefined') {
      throw new Error('Reducer "' + key + '" returned undefined during initialization. ' + 'If the state passed to the reducer is undefined, you must ' + 'explicitly return the initial state. The initial state may ' + 'not be undefined.');
    }

    var type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.');
    if (typeof reducer(undefined, { type: type }) === 'undefined') {
      throw new Error('Reducer "' + key + '" returned undefined when probed with a random type. ' + ('Don\'t try to handle ' + _createStore.ActionTypes.INIT + ' or other actions in "redux/*" ') + 'namespace. They are considered private. Instead, you must return the ' + 'current state for any unknown actions, unless it is undefined, ' + 'in which case you must return the initial state, regardless of the ' + 'action type. The initial state may not be undefined.');
    }
  });
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers);
  var finalReducers = {};
  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i];

    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        (0, _warning2['default'])('No reducer provided for key "' + key + '"');
      }
    }

    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }
  var finalReducerKeys = Object.keys(finalReducers);

  if (process.env.NODE_ENV !== 'production') {
    var unexpectedKeyCache = {};
  }

  var sanityError;
  try {
    assertReducerSanity(finalReducers);
  } catch (e) {
    sanityError = e;
  }

  return function combination() {
    var state = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    var action = arguments[1];

    if (sanityError) {
      throw sanityError;
    }

    if (process.env.NODE_ENV !== 'production') {
      var warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache);
      if (warningMessage) {
        (0, _warning2['default'])(warningMessage);
      }
    }

    var hasChanged = false;
    var nextState = {};
    for (var i = 0; i < finalReducerKeys.length; i++) {
      var key = finalReducerKeys[i];
      var reducer = finalReducers[key];
      var previousStateForKey = state[key];
      var nextStateForKey = reducer(previousStateForKey, action);
      if (typeof nextStateForKey === 'undefined') {
        var errorMessage = getUndefinedStateErrorMessage(key, action);
        throw new Error(errorMessage);
      }
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}
}).call(this,require('_process'))

},{"./createStore":23,"./utils/warning":25,"_process":18,"lodash/isPlainObject":17}],22:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports["default"] = compose;
/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

function compose() {
  for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function (arg) {
      return arg;
    };
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  var last = funcs[funcs.length - 1];
  var rest = funcs.slice(0, -1);
  return function () {
    return rest.reduceRight(function (composed, f) {
      return f(composed);
    }, last.apply(undefined, arguments));
  };
}
},{}],23:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.ActionTypes = undefined;
exports['default'] = createStore;

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var ActionTypes = exports.ActionTypes = {
  INIT: '@@redux/INIT'
};

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [preloadedState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} enhancer The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
function createStore(reducer, preloadedState, enhancer) {
  var _ref2;

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.');
    }

    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.');
  }

  var currentReducer = reducer;
  var currentState = preloadedState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return currentState;
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.');
    }

    var isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {
    if (!(0, _isPlainObject2['default'])(action)) {
      throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
    }

    if (typeof action.type === 'undefined') {
      throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant?');
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = currentListeners = nextListeners;
    for (var i = 0; i < listeners.length; i++) {
      listeners[i]();
    }

    return action;
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.');
    }

    currentReducer = nextReducer;
    dispatch({ type: ActionTypes.INIT });
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/zenparsing/es-observable
   */
  function observable() {
    var _ref;

    var outerSubscribe = subscribe;
    return _ref = {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe: function subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.');
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState());
          }
        }

        observeState();
        var unsubscribe = outerSubscribe(observeState);
        return { unsubscribe: unsubscribe };
      }
    }, _ref[_symbolObservable2['default']] = function () {
      return this;
    }, _ref;
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT });

  return _ref2 = {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  }, _ref2[_symbolObservable2['default']] = observable, _ref2;
}
},{"lodash/isPlainObject":17,"symbol-observable":26}],24:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;
exports.compose = exports.applyMiddleware = exports.bindActionCreators = exports.combineReducers = exports.createStore = undefined;

var _createStore = require('./createStore');

var _createStore2 = _interopRequireDefault(_createStore);

var _combineReducers = require('./combineReducers');

var _combineReducers2 = _interopRequireDefault(_combineReducers);

var _bindActionCreators = require('./bindActionCreators');

var _bindActionCreators2 = _interopRequireDefault(_bindActionCreators);

var _applyMiddleware = require('./applyMiddleware');

var _applyMiddleware2 = _interopRequireDefault(_applyMiddleware);

var _compose = require('./compose');

var _compose2 = _interopRequireDefault(_compose);

var _warning = require('./utils/warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/*
* This is a dummy function to check if the function name has been altered by minification.
* If the function has been minified and NODE_ENV !== 'production', warn the user.
*/
function isCrushed() {}

if (process.env.NODE_ENV !== 'production' && typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
  (0, _warning2['default'])('You are currently using minified code outside of NODE_ENV === \'production\'. ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or DefinePlugin for webpack (http://stackoverflow.com/questions/30030031) ' + 'to ensure you have the correct code for your production build.');
}

exports.createStore = _createStore2['default'];
exports.combineReducers = _combineReducers2['default'];
exports.bindActionCreators = _bindActionCreators2['default'];
exports.applyMiddleware = _applyMiddleware2['default'];
exports.compose = _compose2['default'];
}).call(this,require('_process'))

},{"./applyMiddleware":19,"./bindActionCreators":20,"./combineReducers":21,"./compose":22,"./createStore":23,"./utils/warning":25,"_process":18}],25:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = warning;
/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
  /* eslint-enable no-console */
  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message);
    /* eslint-disable no-empty */
  } catch (e) {}
  /* eslint-enable no-empty */
}
},{}],26:[function(require,module,exports){
module.exports = require('./lib/index');

},{"./lib/index":27}],27:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ponyfill = require('./ponyfill');

var _ponyfill2 = _interopRequireDefault(_ponyfill);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var root; /* global window */


if (typeof self !== 'undefined') {
  root = self;
} else if (typeof window !== 'undefined') {
  root = window;
} else if (typeof global !== 'undefined') {
  root = global;
} else if (typeof module !== 'undefined') {
  root = module;
} else {
  root = Function('return this')();
}

var result = (0, _ponyfill2['default'])(root);
exports['default'] = result;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./ponyfill":28}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports['default'] = symbolObservablePonyfill;
function symbolObservablePonyfill(root) {
	var result;
	var _Symbol = root.Symbol;

	if (typeof _Symbol === 'function') {
		if (_Symbol.observable) {
			result = _Symbol.observable;
		} else {
			result = _Symbol('observable');
			_Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
};
},{}],29:[function(require,module,exports){
(function (global){
const algebra = require('algebra.js')
const { createStore } = require('redux')

global.algebra = algebra

const initialState = {
  steps: [],
  scope: {},
  focus: 0
}

function reducer (state = initialState, action) {
  switch (action.type) {
    case 'ADD STEP':
      {  // add scope to allow `let var = ` inside switch case
        let num = state.steps.length
        let input = ''
        let output = ''
        state.steps.push({ num, input, output })
        state.focus = num
        return state
      }

    case 'STEP INPUT':
      {
        let num = action.num
        let input = action.input
        let [node, output] = evaluateInput(input, state.scope)
        state.steps[num] = { num, input, node, output }
        return state
      }

    case 'FOCUS':
      state.focus = action.num
      return state

    case 'FOCUS DECREMENT':
      {
        let f = state.focus - 1
        state.focus = f > 0 ? f : 0
        return state
      }

    case 'FOCUS INCREMENT':
      {
        let f = state.focus + 1
        state.focus = f < state.steps.length ? f : state.focus
        return state
      }

    default:
      return state
  }
}

const store = createStore(reducer)
global.store = store

store.subscribe(() => {
  const _steps = document.getElementById('steps')
  let state = store.getState()

  _steps.innerHTML = ''

  state.steps.forEach(step => {
    let elm = Step(step)
    _steps.appendChild(elm)

    if (state.focus === step.num) {
      elm.childNodes[0].focus()
    }
  })
})

store.dispatch({ type: 'ADD STEP' })

function Step (step) {
  let elm = Elm('<div class=step></div>')

  let input = Input(step.input)

  // function onUpKey (event) {
  //   // 38 = up key
  //   if (event.keyCode !== 38) {
  //     return
  //   }
  //   Find previous input
  // }
  // TODO: tab completion?

  function onKey (event) {
    let kc = event.keyCode
    // 13 enter, 9 tab, 38 up, 40 down
    if (!(kc === 13 || kc === 9 || kc === 38 || kc === 40)) {
      return
    }
    event.preventDefault()

    store.dispatch({
      type: 'STEP INPUT',
      num: step.num,
      input: input.value
    })

    if (kc === 38 || event.shiftKey && kc === 9) {
      store.dispatch({ type: 'FOCUS DECREMENT' })
    } else if (kc === 40) {
      store.dispatch({ type: 'FOCUS INCREMENT' })
    } else if (!event.shiftKey && store.getState().steps.length <= step.num + 1) {
      store.dispatch({ type: 'ADD STEP' })
    } else if (!event.shiftKey) {
      store.dispatch({ type: 'FOCUS INCREMENT' })
    }
  }

  function onClick () {
    store.dispatch({ type: 'FOCUS', num: step.num })
  }

  input.addEventListener('keydown', onKey)
  input.addEventListener('click', onClick)
  elm.appendChild(input)

  elm.appendChild(Output(step.output))

  return elm
}

function Input (value) {
  let elm = Elm(`<input type=text>`)
  elm.value = value
  return elm
}

function Output (str) {
  return Elm(`<div class=output>${str}</div>`)
}

function Elm (html) {
  let div = document.createElement('div')
  div.innerHTML = html
  return div.childNodes[0]
}

function evaluateInput (input, scope) {
  let node, output
  try {
    node = algebra.parse(input)
  } catch (err) {
    output = err.message
  }
  output = node ? node.toString() : ''
  return [ node, output ]
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"algebra.js":1,"redux":24}]},{},[29])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYWxnZWJyYS5qcy9hbGdlYnJhLmpzIiwibm9kZV9tb2R1bGVzL2FsZ2VicmEuanMvc3JjL2VxdWF0aW9ucy5qcyIsIm5vZGVfbW9kdWxlcy9hbGdlYnJhLmpzL3NyYy9leHByZXNzaW9ucy5qcyIsIm5vZGVfbW9kdWxlcy9hbGdlYnJhLmpzL3NyYy9mcmFjdGlvbnMuanMiLCJub2RlX21vZHVsZXMvYWxnZWJyYS5qcy9zcmMvaGVscGVyLmpzIiwibm9kZV9tb2R1bGVzL2FsZ2VicmEuanMvc3JjL2xleGVyLmpzIiwibm9kZV9tb2R1bGVzL2FsZ2VicmEuanMvc3JjL3BhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX1N5bWJvbC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2Jhc2VHZXRUYWcuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19mcmVlR2xvYmFsLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fZ2V0UHJvdG90eXBlLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fZ2V0UmF3VGFnLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fb2JqZWN0VG9TdHJpbmcuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19vdmVyQXJnLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fcm9vdC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaXNPYmplY3RMaWtlLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pc1BsYWluT2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9yZWR1eC9saWIvYXBwbHlNaWRkbGV3YXJlLmpzIiwibm9kZV9tb2R1bGVzL3JlZHV4L2xpYi9iaW5kQWN0aW9uQ3JlYXRvcnMuanMiLCJub2RlX21vZHVsZXMvcmVkdXgvbGliL2NvbWJpbmVSZWR1Y2Vycy5qcyIsIm5vZGVfbW9kdWxlcy9yZWR1eC9saWIvY29tcG9zZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWR1eC9saWIvY3JlYXRlU3RvcmUuanMiLCJub2RlX21vZHVsZXMvcmVkdXgvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3JlZHV4L2xpYi91dGlscy93YXJuaW5nLmpzIiwibm9kZV9tb2R1bGVzL3N5bWJvbC1vYnNlcnZhYmxlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N5bWJvbC1vYnNlcnZhYmxlL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zeW1ib2wtb2JzZXJ2YWJsZS9saWIvcG9ueWZpbGwuanMiLCJzcmMvYWxnZWJyYS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL01BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3BRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTs7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgRnJhY3Rpb24gPSByZXF1aXJlKCcuL3NyYy9mcmFjdGlvbnMnKTtcbnZhciBFeHByZXNzaW9uID0gcmVxdWlyZSgnLi9zcmMvZXhwcmVzc2lvbnMnKS5FeHByZXNzaW9uO1xudmFyIEVxdWF0aW9uID0gcmVxdWlyZSgnLi9zcmMvZXF1YXRpb25zJyk7XG52YXIgUGFyc2VyID0gcmVxdWlyZSgnLi9zcmMvcGFyc2VyJyk7XG5cblxudmFyIHBhcnNlID0gZnVuY3Rpb24oaW5wdXQpe1xuXHR2YXIgcGFyc2VyID0gbmV3IFBhcnNlcigpO1xuXHR2YXIgcmVzdWx0ID0gcGFyc2VyLnBhcnNlKGlucHV0KTtcblx0cmV0dXJuIHJlc3VsdDtcbn07XG5cbnZhciB0b1RleCA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgaWYgKGlucHV0IGluc3RhbmNlb2YgRnJhY3Rpb24gfHwgaW5wdXQgaW5zdGFuY2VvZiBFeHByZXNzaW9uIHx8IGlucHV0IGluc3RhbmNlb2YgRXF1YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnRvVGV4KCk7XG4gICAgfSBlbHNlIGlmIChpbnB1dCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5tYXAoXG4gICAgICAgICAgICBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBGcmFjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZS50b1RleCgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICApLmpvaW4oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gaW5wdXQudG9TdHJpbmcoKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBGcmFjdGlvbjogRnJhY3Rpb24sXG4gICAgRXhwcmVzc2lvbjogRXhwcmVzc2lvbixcbiAgICBFcXVhdGlvbjogRXF1YXRpb24sXG4gICAgcGFyc2U6IHBhcnNlLFxuICAgIHRvVGV4OiB0b1RleFxufTtcbiIsInZhciBFeHByZXNzaW9uID0gcmVxdWlyZSgnLi9leHByZXNzaW9ucycpLkV4cHJlc3Npb247XG52YXIgVmFyaWFibGUgPSByZXF1aXJlKCcuL2V4cHJlc3Npb25zJykuVmFyaWFibGU7XG52YXIgVGVybSA9IHJlcXVpcmUoJy4vZXhwcmVzc2lvbnMnKS5UZXJtO1xudmFyIEZyYWN0aW9uID0gcmVxdWlyZSgnLi9mcmFjdGlvbnMnKTtcbnZhciBpc0ludCA9IHJlcXVpcmUoJy4vaGVscGVyJykuaXNJbnQ7XG5cbnZhciBFcXVhdGlvbiA9IGZ1bmN0aW9uKGxocywgcmhzKSB7XG4gICAgaWYgKGxocyBpbnN0YW5jZW9mIEV4cHJlc3Npb24pIHtcbiAgICAgICAgdGhpcy5saHMgPSBsaHM7XG5cbiAgICAgICAgaWYgKHJocyBpbnN0YW5jZW9mIEV4cHJlc3Npb24pIHtcbiAgICAgICAgICAgIHRoaXMucmhzID0gcmhzO1xuICAgICAgICB9IGVsc2UgaWYgKHJocyBpbnN0YW5jZW9mIEZyYWN0aW9uIHx8IGlzSW50KHJocykpIHtcbiAgICAgICAgICAgIHRoaXMucmhzID0gbmV3IEV4cHJlc3Npb24ocmhzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIEFyZ3VtZW50IChcIiArIHJocy50b1N0cmluZygpICsgXCIpOiBSaWdodC1oYW5kIHNpZGUgbXVzdCBiZSBvZiB0eXBlIEV4cHJlc3Npb24sIEZyYWN0aW9uIG9yIEludGVnZXIuXCIpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgQXJndW1lbnQgKFwiICsgbGhzLnRvU3RyaW5nKCkgKyBcIik6IExlZnQtaGFuZCBzaWRlIG11c3QgYmUgb2YgdHlwZSBFeHByZXNzaW9uLlwiKTtcbiAgICB9XG59O1xuXG5FcXVhdGlvbi5wcm90b3R5cGUuc29sdmVGb3IgPSBmdW5jdGlvbih2YXJpYWJsZSkge1xuICAgIGlmICghdGhpcy5saHMuX2hhc1ZhcmlhYmxlKHZhcmlhYmxlKSAmJiAhdGhpcy5yaHMuX2hhc1ZhcmlhYmxlKHZhcmlhYmxlKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyB2YXJpYWJsZS50b1N0cmluZygpICsgXCIpOiBWYXJpYWJsZSBkb2VzIG5vdCBleGlzdCBpbiB0aGUgZXF1YXRpb24uXCIpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBlcXVhdGlvbiBpcyBsaW5lYXIgYW5kIHRoZSB2YXJpYWJsZSBpbiBxdWVzdGlvbiBjYW4gYmUgaXNvbGF0ZWQgdGhyb3VnaCBhcml0aG1ldGljLCBzb2x2ZS5cbiAgICBpZiAodGhpcy5faXNMaW5lYXIoKSB8fCB0aGlzLl92YXJpYWJsZUNhbkJlSXNvbGF0ZWQodmFyaWFibGUpKSB7XG4gICAgICAgIHZhciBzb2x2aW5nRm9yID0gbmV3IFRlcm0obmV3IFZhcmlhYmxlKHZhcmlhYmxlKSk7XG4gICAgICAgIHZhciBuZXdMaHMgPSBuZXcgRXhwcmVzc2lvbigpO1xuICAgICAgICB2YXIgbmV3UmhzID0gbmV3IEV4cHJlc3Npb24oKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucmhzLnRlcm1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgdGVybSA9IHRoaXMucmhzLnRlcm1zW2ldO1xuXG4gICAgICAgICAgICBpZiAodGVybS5jYW5CZUNvbWJpbmVkV2l0aChzb2x2aW5nRm9yKSkge1xuICAgICAgICAgICAgICAgIG5ld0xocyA9IG5ld0xocy5zdWJ0cmFjdCh0ZXJtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV3UmhzID0gbmV3UmhzLmFkZCh0ZXJtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saHMudGVybXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0ZXJtID0gdGhpcy5saHMudGVybXNbaV07XG5cbiAgICAgICAgICAgIGlmICh0ZXJtLmNhbkJlQ29tYmluZWRXaXRoKHNvbHZpbmdGb3IpKSB7XG4gICAgICAgICAgICAgICAgbmV3TGhzID0gbmV3TGhzLmFkZCh0ZXJtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV3UmhzID0gbmV3UmhzLnN1YnRyYWN0KHRlcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbmV3UmhzID0gbmV3UmhzLnN1YnRyYWN0KHRoaXMubGhzLmNvbnN0YW50KCkpO1xuICAgICAgICBuZXdSaHMgPSBuZXdSaHMuYWRkKHRoaXMucmhzLmNvbnN0YW50KCkpO1xuXG4gICAgICAgIGlmIChuZXdMaHMudGVybXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBpZiAobmV3TGhzLmNvbnN0YW50KCkuZXF1YWxUbyhuZXdSaHMuY29uc3RhbnQoKSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEZyYWN0aW9uKDEsIDEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXZhbEVycm9yKFwiTm8gU29sdXRpb25cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBuZXdSaHMgPSBuZXdSaHMuZGl2aWRlKG5ld0xocy50ZXJtc1swXS5jb2VmZmljaWVudCgpKTtcblxuICAgICAgICBpZiAobmV3UmhzLnRlcm1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ld1Jocy5jb25zdGFudCgpLnJlZHVjZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgbmV3UmhzLl9zb3J0KCk7XG4gICAgICAgIHJldHVybiBuZXdSaHM7XG5cbiAgICAvLyBPdGhlcndpc2UsIG1vdmUgZXZlcnl0aGluZyB0byB0aGUgTEhTLlxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBuZXdMaHMgPSB0aGlzLmxocy5jb3B5KCk7XG4gICAgICAgIG5ld0xocyA9IG5ld0xocy5zdWJ0cmFjdCh0aGlzLnJocyk7XG5cbiAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIHRlcm1zIGxlZnQgYWZ0ZXIgdGhpcyByZWFycmFuZ2VtZW50IGFuZCB0aGUgY29uc3RhbnQgaXMgMCwgdGhlcmUgYXJlIGluZmluaXRlIHNvbHV0aW9ucy5cbiAgICAgICAgLy8gT3RoZXJ3aXNlLCB0aGVyZSBhcmUgbm8gc29sdXRpb25zLlxuICAgICAgICBpZiAobmV3TGhzLnRlcm1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKG5ld0xocy5jb25zdGFudCgpLnZhbHVlT2YoKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBbbmV3IEZyYWN0aW9uKDEsIDEpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEV2YWxFcnJvcihcIk5vIFNvbHV0aW9uXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIC8vIE90aGVyd2lzZSwgY2hlY2sgZGVncmVlIGFuZCBzb2x2ZS5cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9pc1F1YWRyYXRpYyh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIHZhciBjb2VmcyA9IG5ld0xocy5fcXVhZHJhdGljQ29lZmZpY2llbnRzKCk7XG5cbiAgICAgICAgICAgIHZhciBhID0gY29lZnMuYTtcbiAgICAgICAgICAgIHZhciBiID0gY29lZnMuYjtcbiAgICAgICAgICAgIHZhciBjID0gY29lZnMuYztcblxuICAgICAgICAgICAgLy8gQ2FsY3VsYXRlIHRoZSBkaXNjcmltaW5hbnQsIGJeMiAtIDRhYy5cbiAgICAgICAgICAgIHZhciBkaXNjcmltaW5hbnQgPSBiLnBvdygyKS5zdWJ0cmFjdChhLm11bHRpcGx5KGMpLm11bHRpcGx5KDQpKTtcblxuICAgICAgICAgICAgLy8gSWYgdGhlIGRpc2NyaW1pbmFudCBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gMCwgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIHJlYWwgcm9vdC5cbiAgICAgICAgICAgIGlmIChkaXNjcmltaW5hbnQudmFsdWVPZigpID49IDApIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgZGlzY3JpbWluYW50IGlzIGVxdWFsIHRvIDAsIHRoZXJlIGlzIG9uZSByZWFsIHJvb3Q6IC1iIC8gMmEuXG4gICAgICAgICAgICAgICAgaWYgKGRpc2NyaW1pbmFudC52YWx1ZU9mKCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtiLm11bHRpcGx5KC0xKS5kaXZpZGUoYS5tdWx0aXBseSgyKSkucmVkdWNlKCldO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBkaXNjcmltaW5hbnQgaXMgZ3JlYXRlciB0aGFuIDAsIHRoZXJlIGFyZSB0d28gcmVhbCByb290czpcbiAgICAgICAgICAgICAgICAgICAgLy8gKC1iIC0g4oiaZGlzY3JpbWluYW50KSAvIDJhXG4gICAgICAgICAgICAgICAgICAgIC8vICgtYiArIOKImmRpc2NyaW1pbmFudCkgLyAyYVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzcXVhcmVSb290RGlzY3JpbWluYW50O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBhbnN3ZXJzIHdpbGwgYmUgcmF0aW9uYWwsIHJldHVybiByZWR1Y2VkIEZyYWN0aW9uIG9iamVjdHMuXG4gICAgICAgICAgICAgICAgICAgIGlmIChkaXNjcmltaW5hbnQuX3NxdWFyZVJvb3RJc1JhdGlvbmFsKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNxdWFyZVJvb3REaXNjcmltaW5hbnQgPSBkaXNjcmltaW5hbnQucG93KDAuNSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcm9vdDEgPSBiLm11bHRpcGx5KC0xKS5zdWJ0cmFjdChzcXVhcmVSb290RGlzY3JpbWluYW50KS5kaXZpZGUoYS5tdWx0aXBseSgyKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcm9vdDIgPSBiLm11bHRpcGx5KC0xKS5hZGQoc3F1YXJlUm9vdERpc2NyaW1pbmFudCkuZGl2aWRlKGEubXVsdGlwbHkoMikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtyb290MS5yZWR1Y2UoKSwgcm9vdDIucmVkdWNlKCldO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlIGFuc3dlcnMgd2lsbCBiZSBpcnJhdGlvbmFsLCByZXR1cm4gbnVtYmVycy5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNxdWFyZVJvb3REaXNjcmltaW5hbnQgPSBNYXRoLnNxcnQoZGlzY3JpbWluYW50LnZhbHVlT2YoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhID0gYS52YWx1ZU9mKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBiID0gYi52YWx1ZU9mKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByb290MSA9ICgtYiAtIHNxdWFyZVJvb3REaXNjcmltaW5hbnQpIC8gKDIqYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcm9vdDIgPSAoLWIgKyBzcXVhcmVSb290RGlzY3JpbWluYW50KSAvICgyKmEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtyb290MSwgcm9vdDJdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBkaXNjcmltaW5hbnQgaXMgbmVnYXRpdmUsIHRoZXJlIGFyZSBubyByZWFsIHJvb3RzLlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5faXNDdWJpYyh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIHZhciBjb2VmcyA9IG5ld0xocy5fY3ViaWNDb2VmZmljaWVudHMoKTtcblxuICAgICAgICAgICAgdmFyIGEgPSBjb2Vmcy5hO1xuICAgICAgICAgICAgdmFyIGIgPSBjb2Vmcy5iO1xuICAgICAgICAgICAgdmFyIGMgPSBjb2Vmcy5jO1xuICAgICAgICAgICAgdmFyIGQgPSBjb2Vmcy5kO1xuXG4gICAgICAgICAgICAvLyBDYWxjdWxhdGUgRCBhbmQgRDAuXG4gICAgICAgICAgICB2YXIgRCA9IGEubXVsdGlwbHkoYikubXVsdGlwbHkoYykubXVsdGlwbHkoZCkubXVsdGlwbHkoMTgpO1xuICAgICAgICAgICAgRCA9IEQuc3VidHJhY3QoYi5wb3coMykubXVsdGlwbHkoZCkubXVsdGlwbHkoNCkpO1xuICAgICAgICAgICAgRCA9IEQuYWRkKGIucG93KDIpLm11bHRpcGx5KGMucG93KDIpKSk7XG4gICAgICAgICAgICBEID0gRC5zdWJ0cmFjdChhLm11bHRpcGx5KGMucG93KDMpKS5tdWx0aXBseSg0KSk7XG4gICAgICAgICAgICBEID0gRC5zdWJ0cmFjdChhLnBvdygyKS5tdWx0aXBseShkLnBvdygyKSkubXVsdGlwbHkoMjcpKTtcblxuICAgICAgICAgICAgdmFyIEQwID0gYi5wb3coMikuc3VidHJhY3QoYS5tdWx0aXBseShjKS5tdWx0aXBseSgzKSk7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBzcGVjaWFsIGNhc2VzIHdoZW4gRCA9IDAuXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChELnZhbHVlT2YoKSA9PT0gMCkge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gSWYgRCA9IEQwID0gMCwgdGhlcmUgaXMgb25lIGRpc3RpbmN0IHJlYWwgcm9vdCwgLWIgLyAzYS5cbiAgICAgICAgICAgICAgICBpZiAoRDAudmFsdWVPZigpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByb290MSA9IGIubXVsdGlwbHkoLTEpLmRpdmlkZShhLm11bHRpcGx5KDMpKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW3Jvb3QxLnJlZHVjZSgpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBpZiBEMCAhPSAwLCB0aGVyZSBhcmUgdHdvIGRpc3RpbmN0IHJlYWwgcm9vdHMuXG4gICAgICAgICAgICAgICAgICAgIC8vIDlhZCAtIGJjIC8gMkQwXG4gICAgICAgICAgICAgICAgICAgIC8vIDRhYmMgLSA5YV4yZCAtIGJeMyAvIGFEMFxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByb290MSA9IGEubXVsdGlwbHkoYikubXVsdGlwbHkoYykubXVsdGlwbHkoNCk7XG4gICAgICAgICAgICAgICAgICAgIHJvb3QxID0gcm9vdDEuc3VidHJhY3QoYS5wb3coMikubXVsdGlwbHkoZCkubXVsdGlwbHkoOSkpO1xuICAgICAgICAgICAgICAgICAgICByb290MSA9IHJvb3QxLnN1YnRyYWN0KGIucG93KDMpKTtcbiAgICAgICAgICAgICAgICAgICAgcm9vdDEgPSByb290MS5kaXZpZGUoYS5tdWx0aXBseShEMCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciByb290MiA9IGEubXVsdGlwbHkoZCkubXVsdGlwbHkoOSkuc3VidHJhY3QoYi5tdWx0aXBseShjKSkuZGl2aWRlKEQwLm11bHRpcGx5KDIpKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW3Jvb3QxLnJlZHVjZSgpLCByb290Mi5yZWR1Y2UoKV07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCB1c2UgYSBkaWZmZXJlbnQgbWV0aG9kIGZvciBzb2x2aW5nLlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgIHZhciBmID0gKCgzKihjL2EpKSAtICgoTWF0aC5wb3coYiwgMikpLyhNYXRoLnBvdyhhLCAyKSkpKS8zO1xuICAgICAgICAgICAgICAgdmFyIGcgPSAoMiooTWF0aC5wb3coYiwgMykpLyhNYXRoLnBvdyhhLCAzKSkpO1xuICAgICAgICAgICAgICAgZyA9IGcgLSAoOSpiKmMvKE1hdGgucG93KGEsIDIpKSk7XG4gICAgICAgICAgICAgICBnID0gZyArICgyNypkKS9hO1xuICAgICAgICAgICAgICAgZyA9IGcvMjc7XG4gICAgICAgICAgICAgICB2YXIgaCA9IChNYXRoLnBvdyhnLCAyKS80KSArIChNYXRoLnBvdyhmLCAzKS8yNyk7XG5cbiAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICBcdGlmIGYgPSBnID0gaCA9IDAgdGhlbiByb290cyBhcmUgZXF1YWwgKGhhcyBiZWVuIGFscmVhZHkgdGFrZW4gY2FyZSBvZiEpXG4gICAgICAgICAgICAgICBcdGlmIGg+MCwgb25seSBvbmUgcmVhbCByb290XG4gICAgICAgICAgICAgICBcdGlmIGg8PTAsIGFsbCB0aHJlZSByb290cyBhcmUgcmVhbFxuICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgaWYoaD4wKVxuICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgXHRcdFxuICAgICAgICAgICAgICAgXHRcdHZhciBSID0gLShnLzIpICsgTWF0aC5zcXJ0KGgpO1xuICAgICAgICAgICAgICAgXHRcdHZhciBTID0gTWF0aC5jYnJ0KFIpO1xuICAgICAgICAgICAgICAgXHRcdHZhciBUID0gLShnLzIpIC0gTWF0aC5zcXJ0KGgpO1xuICAgICAgICAgICAgICAgXHRcdHZhciBVID0gTWF0aC5jYnJ0KFQpO1xuICAgICAgICAgICAgICAgXHRcdHZhciByb290MSA9IChTK1UpIC0gKGIvKDMqYSkpO1xuICAgICAgICAgICAgICAgXHRcdC8qIFJvdW5kIG9mZiB0aGUgcm9vdHMgaWYgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBhYnNvbHV0ZSB2YWx1ZSBvZiBjZWlsIGFuZCBudW1iZXIgaXMgPCBlLTE1Ki9cbiAgICAgICAgICAgICAgIFx0XHRpZihyb290MTwwKVxuICAgICAgICAgICAgICAgXHRcdHtcbiAgICAgICAgICAgICAgIFx0XHRcdHZhciBDcm9vdDEgPSBNYXRoLmZsb29yKHJvb3QxKTtcbiAgICAgICAgICAgICAgIFx0XHRcdGlmKHJvb3QxIC0gQ3Jvb3QxIDwgMWUtMTUpXG4gICAgICAgICAgICAgICBcdFx0XHRcdHJvb3QxID0gQ3Jvb3QxO1xuICAgICAgICAgICAgICAgXHRcdH1cbiAgICAgICAgICAgICAgIFx0XHRlbHNlIGlmKHJvb3QxPjApXG4gICAgICAgICAgICAgICBcdFx0e1xuICAgICAgICAgICAgICAgXHRcdFx0dmFyIENyb290MSA9IE1hdGguY2VpbChyb290MSk7XG4gICAgICAgICAgICAgICBcdFx0XHRpZihDcm9vdDEgLSByb290MSA8IDFlLTE1KVxuICAgICAgICAgICAgICAgXHRcdFx0XHRyb290MSA9IENyb290MTtcbiAgICAgICAgICAgICAgIFx0XHR9XG4gICAgICAgICAgICAgICBcdFx0XG4gICAgICAgICAgICAgICBcdFx0cmV0dXJuIFtyb290MV07XHRcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgIFx0XHR2YXIgaSA9IE1hdGguc3FydCgoKE1hdGgucG93KGcsIDIpLzQpIC0gaCkpO1xuICAgICAgICAgICAgICAgXHRcdHZhciBqID0gTWF0aC5jYnJ0KGkpO1xuICAgICAgICAgICAgICAgXHRcdFxuICAgICAgICAgICAgICAgXHRcdHZhciBrID0gTWF0aC5hY29zKC0oZy8oMippKSkpO1xuICAgICAgICAgICAgICAgXHRcdHZhciBMID0gLWo7XG4gICAgICAgICAgICAgICBcdFx0dmFyIE0gPSBNYXRoLmNvcyhrLzMpO1xuICAgICAgICAgICAgICAgXHRcdHZhciBOID0gTWF0aC5zcXJ0KDMpICogTWF0aC5zaW4oay8zKTtcbiAgICAgICAgICAgICAgIFx0XHR2YXIgUCA9IC0oYi8oMyphKSk7XG4gICAgICAgICAgICAgICBcdFx0XG4gICAgICAgICAgICAgICBcdFx0dmFyIHJvb3QxID0gMipqKk1hdGguY29zKGsvMykgLSAoYi8oMyphKSk7XG4gICAgICAgICAgICAgICBcdFx0dmFyIHJvb3QyID0gTCooTStOKSArIFA7XG4gICAgICAgICAgICAgICBcdFx0dmFyIHJvb3QzID0gTCooTS1OKSArIFA7XG4gICAgICAgICAgICAgICBcdFx0XG4gICAgICAgICAgICAgICBcdFx0XG4gICAgICAgICAgICAgICBcdFx0LyogUm91bmQgb2ZmIHRoZSByb290cyBpZiB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIGFic29sdXRlIHZhbHVlIG9mIGNlaWwgYW5kIG51bWJlciBpcyA8IGUtMTUqL1xuICAgICAgICAgICAgICAgXHRcdGlmKHJvb3QxPDApXG4gICAgICAgICAgICAgICBcdFx0e1xuICAgICAgICAgICAgICAgXHRcdFx0dmFyIENyb290MSA9IE1hdGguZmxvb3Iocm9vdDEpO1xuICAgICAgICAgICAgICAgXHRcdFx0aWYocm9vdDEgLSBDcm9vdDEgPCAxZS0xNSlcbiAgICAgICAgICAgICAgIFx0XHRcdFx0cm9vdDEgPSBDcm9vdDE7XG4gICAgICAgICAgICAgICBcdFx0fVxuICAgICAgICAgICAgICAgXHRcdGVsc2UgaWYocm9vdDE+MClcbiAgICAgICAgICAgICAgIFx0XHR7XG4gICAgICAgICAgICAgICBcdFx0XHR2YXIgQ3Jvb3QxID0gTWF0aC5jZWlsKHJvb3QxKTtcbiAgICAgICAgICAgICAgIFx0XHRcdGlmKENyb290MSAtIHJvb3QxIDwgMWUtMTUpXG4gICAgICAgICAgICAgICBcdFx0XHRcdHJvb3QxID0gQ3Jvb3QxO1xuICAgICAgICAgICAgICAgXHRcdH1cbiAgICAgICAgICAgICAgIFx0XHRcbiAgICAgICAgICAgICAgIFx0XHRpZihyb290MjwwKVxuICAgICAgICAgICAgICAgXHRcdHtcbiAgICAgICAgICAgICAgIFx0XHRcdHZhciBDcm9vdDIgPSBNYXRoLmZsb29yKHJvb3QyKTtcbiAgICAgICAgICAgICAgIFx0XHRcdGlmKHJvb3QyIC0gQ3Jvb3QyIDwgMWUtMTUpXG4gICAgICAgICAgICAgICBcdFx0XHRcdHJvb3QyID0gQ3Jvb3QyO1xuICAgICAgICAgICAgICAgXHRcdH1cbiAgICAgICAgICAgICAgIFx0XHRlbHNlIGlmKHJvb3QyPjApXG4gICAgICAgICAgICAgICBcdFx0e1xuICAgICAgICAgICAgICAgXHRcdFx0dmFyIENyb290MiA9IE1hdGguY2VpbChyb290Mik7XG4gICAgICAgICAgICAgICBcdFx0XHRpZihDcm9vdDIgLSByb290MiA8IDFlLTE1KVxuICAgICAgICAgICAgICAgXHRcdFx0XHRyb290MiA9IENyb290MjtcbiAgICAgICAgICAgICAgIFx0XHR9XG4gICAgICAgICAgICAgICBcdFx0XG4gICAgICAgICAgICAgICBcdFx0aWYocm9vdDE8MClcbiAgICAgICAgICAgICAgIFx0XHR7XG4gICAgICAgICAgICAgICBcdFx0XHR2YXIgQ3Jvb3QzID0gTWF0aC5mbG9vcihyb290Myk7XG4gICAgICAgICAgICAgICBcdFx0XHRpZihyb290MyAtIENyb290MyA8IDFlLTE1KVxuICAgICAgICAgICAgICAgXHRcdFx0XHRyb290MyA9IENyb290MztcbiAgICAgICAgICAgICAgIFx0XHR9XG4gICAgICAgICAgICAgICBcdFx0ZWxzZSBpZihyb290Mz4wKVxuICAgICAgICAgICAgICAgXHRcdHtcbiAgICAgICAgICAgICAgIFx0XHRcdHZhciBDcm9vdDMgPSBNYXRoLmNlaWwocm9vdDMpO1xuICAgICAgICAgICAgICAgXHRcdFx0aWYoQ3Jvb3QzIC0gcm9vdDMgPCAxZS0xNSlcbiAgICAgICAgICAgICAgIFx0XHRcdFx0cm9vdDMgPSBDcm9vdDM7XG4gICAgICAgICAgICAgICBcdFx0fVxuICAgICAgICAgICAgICAgXHRcdFxuICAgICAgICAgICAgICAgXHRcdHZhciByb290cyA9IFtyb290MSwgcm9vdDIsIHJvb3QzXTtcbiAgICAgICAgICAgICAgIFx0XHRyb290cy5zb3J0KGZ1bmN0aW9uKGEsIGIpe3JldHVybiBhLWI7fSk7XHQvLyByb290cyBpbiBhc2NlbmRpbmcgb3JkZXJcbiAgICAgICAgICAgICAgIFx0XHRcbiAgICAgICAgICAgICAgIFx0XHRyZXR1cm4gW3Jvb3RzWzBdLCByb290c1sxXSwgcm9vdHNbMl1dO1xuICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkVxdWF0aW9uLnByb3RvdHlwZS5ldmFsID0gZnVuY3Rpb24odmFsdWVzKSB7XG4gICAgcmV0dXJuIG5ldyBFcXVhdGlvbih0aGlzLmxocy5ldmFsKHZhbHVlcyksIHRoaXMucmhzLmV2YWwodmFsdWVzKSk7XG59O1xuXG5FcXVhdGlvbi5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5saHMudG9TdHJpbmcoKSArIFwiID0gXCIgKyB0aGlzLnJocy50b1N0cmluZygpO1xufTtcblxuRXF1YXRpb24ucHJvdG90eXBlLnRvVGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubGhzLnRvVGV4KCkgKyBcIiA9IFwiICsgdGhpcy5yaHMudG9UZXgoKTtcbn07XG5cbkVxdWF0aW9uLnByb3RvdHlwZS5fbWF4RGVncmVlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxoc01heCA9IHRoaXMubGhzLl9tYXhEZWdyZWUoKTtcbiAgICB2YXIgcmhzTWF4ID0gdGhpcy5yaHMuX21heERlZ3JlZSgpO1xuICAgIHJldHVybiBNYXRoLm1heChsaHNNYXgsIHJoc01heCk7XG59O1xuXG5FcXVhdGlvbi5wcm90b3R5cGUuX21heERlZ3JlZU9mVmFyaWFibGUgPSBmdW5jdGlvbih2YXJpYWJsZSkge1xuICAgIHJldHVybiBNYXRoLm1heCh0aGlzLmxocy5fbWF4RGVncmVlT2ZWYXJpYWJsZSh2YXJpYWJsZSksIHRoaXMucmhzLl9tYXhEZWdyZWVPZlZhcmlhYmxlKHZhcmlhYmxlKSk7XG59O1xuXG5FcXVhdGlvbi5wcm90b3R5cGUuX3ZhcmlhYmxlQ2FuQmVJc29sYXRlZCA9IGZ1bmN0aW9uKHZhcmlhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMuX21heERlZ3JlZU9mVmFyaWFibGUodmFyaWFibGUpID09PSAxICYmIHRoaXMuX25vQ3Jvc3NQcm9kdWN0c1dpdGhWYXJpYWJsZSh2YXJpYWJsZSk7XG59O1xuXG5FcXVhdGlvbi5wcm90b3R5cGUuX25vQ3Jvc3NQcm9kdWN0c1dpdGhWYXJpYWJsZSA9IGZ1bmN0aW9uKHZhcmlhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMubGhzLl9ub0Nyb3NzUHJvZHVjdHNXaXRoVmFyaWFibGUodmFyaWFibGUpICYmIHRoaXMucmhzLl9ub0Nyb3NzUHJvZHVjdHNXaXRoVmFyaWFibGUodmFyaWFibGUpO1xufTtcblxuRXF1YXRpb24ucHJvdG90eXBlLl9ub0Nyb3NzUHJvZHVjdHMgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5saHMuX25vQ3Jvc3NQcm9kdWN0cygpICYmIHRoaXMucmhzLl9ub0Nyb3NzUHJvZHVjdHMoKTtcbn07XG5cbkVxdWF0aW9uLnByb3RvdHlwZS5fb25seUhhc1ZhcmlhYmxlID0gZnVuY3Rpb24odmFyaWFibGUpIHtcbiAgICByZXR1cm4gdGhpcy5saHMuX29ubHlIYXNWYXJpYWJsZSh2YXJpYWJsZSkgJiYgdGhpcy5yaHMuX29ubHlIYXNWYXJpYWJsZSh2YXJpYWJsZSk7XG59O1xuXG5FcXVhdGlvbi5wcm90b3R5cGUuX2lzTGluZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX21heERlZ3JlZSgpID09PSAxICYmIHRoaXMuX25vQ3Jvc3NQcm9kdWN0cygpO1xufTtcblxuRXF1YXRpb24ucHJvdG90eXBlLl9pc1F1YWRyYXRpYyA9IGZ1bmN0aW9uKHZhcmlhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMuX21heERlZ3JlZSgpID09PSAyICYmIHRoaXMuX29ubHlIYXNWYXJpYWJsZSh2YXJpYWJsZSk7XG59O1xuXG5FcXVhdGlvbi5wcm90b3R5cGUuX2lzQ3ViaWMgPSBmdW5jdGlvbih2YXJpYWJsZSkge1xuICAgIHJldHVybiB0aGlzLl9tYXhEZWdyZWUoKSA9PT0gMyAmJiB0aGlzLl9vbmx5SGFzVmFyaWFibGUodmFyaWFibGUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFcXVhdGlvbjtcbiIsInZhciBGcmFjdGlvbiA9IHJlcXVpcmUoJy4vZnJhY3Rpb25zJyk7XG52YXIgaXNJbnQgPSByZXF1aXJlKCcuL2hlbHBlcicpLmlzSW50O1xudmFyIEdSRUVLX0xFVFRFUlMgPSByZXF1aXJlKCcuL2hlbHBlcicpLkdSRUVLX0xFVFRFUlM7XG5cbnZhciBFeHByZXNzaW9uID0gZnVuY3Rpb24odmFyaWFibGUpIHtcbiAgICB0aGlzLmNvbnN0YW50cyA9IFtdO1xuXG4gICAgaWYodHlwZW9mKHZhcmlhYmxlKSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICB2YXIgdiA9IG5ldyBWYXJpYWJsZSh2YXJpYWJsZSk7XG4gICAgICAgIHZhciB0ID0gbmV3IFRlcm0odik7XG4gICAgICAgIHRoaXMudGVybXMgPSBbdF07XG4gICAgfSBlbHNlIGlmKGlzSW50KHZhcmlhYmxlKSkge1xuICAgICAgICB0aGlzLmNvbnN0YW50cyA9IFtuZXcgRnJhY3Rpb24odmFyaWFibGUsIDEpXTtcbiAgICAgICAgdGhpcy50ZXJtcyA9IFtdO1xuICAgIH0gZWxzZSBpZih2YXJpYWJsZSBpbnN0YW5jZW9mIEZyYWN0aW9uKSB7XG4gICAgICAgIHRoaXMuY29uc3RhbnRzID0gW3ZhcmlhYmxlXTtcbiAgICAgICAgdGhpcy50ZXJtcyA9IFtdO1xuICAgIH0gZWxzZSBpZih2YXJpYWJsZSBpbnN0YW5jZW9mIFRlcm0pIHtcbiAgICAgICAgdGhpcy50ZXJtcyA9IFt2YXJpYWJsZV07XG4gICAgfSBlbHNlIGlmKHR5cGVvZih2YXJpYWJsZSkgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgdGhpcy50ZXJtcyA9IFtdO1xuICAgIH1lbHNle1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyB2YXJpYWJsZS50b1N0cmluZygpICsgXCIpOiBBcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgU3RyaW5nLCBJbnRlZ2VyLCBGcmFjdGlvbiBvciBUZXJtLlwiKTtcbiAgICB9XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS5jb25zdGFudCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0YW50cy5yZWR1Y2UoZnVuY3Rpb24ocCxjKXtyZXR1cm4gcC5hZGQoYyk7fSxuZXcgRnJhY3Rpb24oMCwgMSkpO1xufTtcblxuRXhwcmVzc2lvbi5wcm90b3R5cGUuc2ltcGxpZnkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29weSA9IHRoaXMuY29weSgpO1xuXG4gICAgLy9zaW1wbGlmeSBhbGwgdGVybXNcbiAgICBjb3B5LnRlcm1zID0gY29weS50ZXJtcy5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHQuc2ltcGxpZnkoKTt9KTtcblxuICAgIGNvcHkuX3NvcnQoKTtcbiAgICBjb3B5Ll9jb21iaW5lTGlrZVRlcm1zKCk7XG4gICAgY29weS5fbW92ZVRlcm1zV2l0aERlZ3JlZVplcm9Ub0NvbnN0YW50cygpO1xuICAgIGNvcHkuX3JlbW92ZVRlcm1zV2l0aENvZWZmaWNpZW50WmVybygpO1xuICAgIGNvcHkuY29uc3RhbnRzID0gKGNvcHkuY29uc3RhbnQoKS52YWx1ZU9mKCkgPT09IDAgPyBbXSA6IFtjb3B5LmNvbnN0YW50KCldKTtcblxuICAgIHJldHVybiBjb3B5O1xufTtcblxuRXhwcmVzc2lvbi5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb3B5ID0gbmV3IEV4cHJlc3Npb24oKTtcbiAgICBcbiAgICAvL2NvcHkgYWxsIGNvbnN0YW50c1xuICAgIGNvcHkuY29uc3RhbnRzID0gdGhpcy5jb25zdGFudHMubWFwKGZ1bmN0aW9uKGMpe3JldHVybiBjLmNvcHkoKTt9KTtcbiAgICAvL2NvcHkgYWxsIHRlcm1zXG4gICAgY29weS50ZXJtcyA9IHRoaXMudGVybXMubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0LmNvcHkoKTt9KTtcblxuICAgIHJldHVybiBjb3B5O1xufTtcblxuRXhwcmVzc2lvbi5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oYSwgc2ltcGxpZnkpIHtcbiAgICB2YXIgdGhpc0V4cCA9IHRoaXMuY29weSgpO1xuXG4gICAgaWYgKHR5cGVvZihhKSA9PT0gXCJzdHJpbmdcIiB8fCBhIGluc3RhbmNlb2YgVGVybSB8fCBpc0ludChhKSB8fCBhIGluc3RhbmNlb2YgRnJhY3Rpb24pIHtcbiAgICAgICAgdmFyIGV4cCA9IG5ldyBFeHByZXNzaW9uKGEpO1xuICAgICAgICByZXR1cm4gdGhpc0V4cC5hZGQoZXhwLCBzaW1wbGlmeSk7XG4gICAgfSBlbHNlIGlmIChhIGluc3RhbmNlb2YgRXhwcmVzc2lvbikge1xuICAgICAgICB2YXIga2VlcFRlcm1zID0gYS5jb3B5KCkudGVybXM7XG5cbiAgICAgICAgdGhpc0V4cC50ZXJtcyA9IHRoaXNFeHAudGVybXMuY29uY2F0KGtlZXBUZXJtcyk7XG4gICAgICAgIHRoaXNFeHAuY29uc3RhbnRzID0gdGhpc0V4cC5jb25zdGFudHMuY29uY2F0KGEuY29uc3RhbnRzKTtcbiAgICAgICAgdGhpc0V4cC5fc29ydCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIEFyZ3VtZW50IChcIiArIGEudG9TdHJpbmcoKSArIFwiKTogU3VtbWFuZCBtdXN0IGJlIG9mIHR5cGUgU3RyaW5nLCBFeHByZXNzaW9uLCBUZXJtLCBGcmFjdGlvbiBvciBJbnRlZ2VyLlwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gKHNpbXBsaWZ5IHx8IHNpbXBsaWZ5ID09PSB1bmRlZmluZWQpID8gdGhpc0V4cC5zaW1wbGlmeSgpIDogdGhpc0V4cDtcbn07XG5cbkV4cHJlc3Npb24ucHJvdG90eXBlLnN1YnRyYWN0ID0gZnVuY3Rpb24oYSwgc2ltcGxpZnkpIHtcbiAgICB2YXIgbmVnYXRpdmUgPSAoYSBpbnN0YW5jZW9mIEV4cHJlc3Npb24pID8gYS5tdWx0aXBseSgtMSkgOiBuZXcgRXhwcmVzc2lvbihhKS5tdWx0aXBseSgtMSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkKG5lZ2F0aXZlLCBzaW1wbGlmeSk7XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS5tdWx0aXBseSA9IGZ1bmN0aW9uKGEsIHNpbXBsaWZ5KSB7XG4gICAgdmFyIHRoaXNFeHAgPSB0aGlzLmNvcHkoKTtcblxuICAgIGlmICh0eXBlb2YoYSkgPT09IFwic3RyaW5nXCIgfHwgYSBpbnN0YW5jZW9mIFRlcm0gfHwgaXNJbnQoYSkgfHwgYSBpbnN0YW5jZW9mIEZyYWN0aW9uKSB7XG4gICAgICAgIHZhciBleHAgPSBuZXcgRXhwcmVzc2lvbihhKTtcbiAgICAgICAgcmV0dXJuIHRoaXNFeHAubXVsdGlwbHkoZXhwLCBzaW1wbGlmeSk7XG4gICAgfSBlbHNlIGlmIChhIGluc3RhbmNlb2YgRXhwcmVzc2lvbikge1xuICAgICAgICB2YXIgdGhhdEV4cCA9IGEuY29weSgpO1xuICAgICAgICB2YXIgbmV3VGVybXMgPSBbXTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXNFeHAudGVybXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0aGlzVGVybSA9IHRoaXNFeHAudGVybXNbaV07XG5cbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdGhhdEV4cC50ZXJtcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHZhciB0aGF0VGVybSA9IHRoYXRFeHAudGVybXNbal07XG4gICAgICAgICAgICAgICAgbmV3VGVybXMucHVzaCh0aGlzVGVybS5tdWx0aXBseSh0aGF0VGVybSwgc2ltcGxpZnkpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCB0aGF0RXhwLmNvbnN0YW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIG5ld1Rlcm1zLnB1c2godGhpc1Rlcm0ubXVsdGlwbHkodGhhdEV4cC5jb25zdGFudHNbal0sIHNpbXBsaWZ5KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoYXRFeHAudGVybXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0aGF0VGVybSA9IHRoYXRFeHAudGVybXNbaV07XG5cbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdGhpc0V4cC5jb25zdGFudHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBuZXdUZXJtcy5wdXNoKHRoYXRUZXJtLm11bHRpcGx5KHRoaXNFeHAuY29uc3RhbnRzW2pdLCBzaW1wbGlmeSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5ld0NvbnN0YW50cyA9IFtdO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpc0V4cC5jb25zdGFudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0aGlzQ29uc3QgPSB0aGlzRXhwLmNvbnN0YW50c1tpXTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCB0aGF0RXhwLmNvbnN0YW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHZhciB0aGF0Q29uc3QgPSB0aGF0RXhwLmNvbnN0YW50c1tqXTtcbiAgICAgICAgICAgICAgICB2YXIgdCA9IG5ldyBUZXJtKCk7XG4gICAgICAgICAgICAgICAgdCA9IHQubXVsdGlwbHkodGhhdENvbnN0LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgdCA9IHQubXVsdGlwbHkodGhpc0NvbnN0LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgbmV3VGVybXMucHVzaCh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXNFeHAuY29uc3RhbnRzID0gbmV3Q29uc3RhbnRzO1xuICAgICAgICB0aGlzRXhwLnRlcm1zID0gbmV3VGVybXM7XG4gICAgICAgIHRoaXNFeHAuX3NvcnQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyBhLnRvU3RyaW5nKCkgKyBcIik6IE11bHRpcGxpY2FuZCBtdXN0IGJlIG9mIHR5cGUgU3RyaW5nLCBFeHByZXNzaW9uLCBUZXJtLCBGcmFjdGlvbiBvciBJbnRlZ2VyLlwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gKHNpbXBsaWZ5IHx8IHNpbXBsaWZ5ID09PSB1bmRlZmluZWQpID8gdGhpc0V4cC5zaW1wbGlmeSgpIDogdGhpc0V4cDtcbn07XG5cbkV4cHJlc3Npb24ucHJvdG90eXBlLmRpdmlkZSA9IGZ1bmN0aW9uKGEsIHNpbXBsaWZ5KSB7XG4gICAgaWYgKGEgaW5zdGFuY2VvZiBGcmFjdGlvbiB8fCBpc0ludChhKSkge1xuXG4gICAgICAgIGlmIChhLnZhbHVlT2YoKSA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEV2YWxFcnJvcihcIkRpdmlkZSBCeSBaZXJvXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvcHkgPSB0aGlzLmNvcHkoKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvcHkudGVybXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0aGlzVGVybSA9IGNvcHkudGVybXNbaV07XG5cbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdGhpc1Rlcm0uY29lZmZpY2llbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgdGhpc1Rlcm0uY29lZmZpY2llbnRzW2pdID0gdGhpc1Rlcm0uY29lZmZpY2llbnRzW2pdLmRpdmlkZShhLCBzaW1wbGlmeSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL2RpdmlkZSBldmVyeSBjb25zdGFudCBieSBhXG4gICAgICAgIGNvcHkuY29uc3RhbnRzID0gY29weS5jb25zdGFudHMubWFwKGZ1bmN0aW9uKGMpe3JldHVybiBjLmRpdmlkZShhLHNpbXBsaWZ5KTt9KTtcblxuICAgICAgICByZXR1cm4gY29weTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyBhLnRvU3RyaW5nKCkgKyBcIik6IERpdmlzb3IgbXVzdCBiZSBvZiB0eXBlIEZyYWN0aW9uIG9yIEludGVnZXIuXCIpO1xuICAgIH1cbn07XG5cbkV4cHJlc3Npb24ucHJvdG90eXBlLnBvdyA9IGZ1bmN0aW9uKGEsIHNpbXBsaWZ5KSB7XG4gICAgaWYgKGlzSW50KGEpKSB7XG4gICAgICAgIHZhciBjb3B5ID0gdGhpcy5jb3B5KCk7XG5cbiAgICAgICAgaWYgKGEgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRXhwcmVzc2lvbigpLmFkZCgxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29weSA9IGNvcHkubXVsdGlwbHkodGhpcywgc2ltcGxpZnkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb3B5Ll9zb3J0KCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKHNpbXBsaWZ5IHx8IHNpbXBsaWZ5ID09PSB1bmRlZmluZWQpID8gY29weS5zaW1wbGlmeSgpIDogY29weTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyBhLnRvU3RyaW5nKCkgKyBcIik6IEV4cG9uZW50IG11c3QgYmUgb2YgdHlwZSBJbnRlZ2VyLlwiKTtcbiAgICB9XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS5ldmFsID0gZnVuY3Rpb24odmFsdWVzLCBzaW1wbGlmeSkge1xuICAgIHZhciBleHAgPSBuZXcgRXhwcmVzc2lvbigpO1xuICAgIGV4cC5jb25zdGFudHMgPSAoc2ltcGxpZnkgPyBbdGhpcy5jb25zdGFudCgpXSA6IHRoaXMuY29uc3RhbnRzLnNsaWNlKCkpO1xuXG4gICAgLy9hZGQgYWxsIGV2YWx1YXRlZCB0ZXJtcyBvZiB0aGlzIHRvIGV4cFxuICAgIGV4cCA9IHRoaXMudGVybXMucmVkdWNlKGZ1bmN0aW9uKHAsYyl7cmV0dXJuIHAuYWRkKGMuZXZhbCh2YWx1ZXMsc2ltcGxpZnkpLHNpbXBsaWZ5KTt9LGV4cCk7XG5cbiAgICByZXR1cm4gZXhwO1xufTtcblxuRXhwcmVzc2lvbi5wcm90b3R5cGUuc3VtbWF0aW9uID0gZnVuY3Rpb24odmFyaWFibGUsIGxvd2VyLCB1cHBlciwgc2ltcGxpZnkpIHtcblx0dmFyIHRoaXNFeHByID0gdGhpcy5jb3B5KCk7XG5cdHZhciBuZXdFeHByID0gbmV3IEV4cHJlc3Npb24oKTtcblx0Zm9yKHZhciBpID0gbG93ZXI7IGkgPCAodXBwZXIgKyAxKTsgaSsrKSB7XG5cdFx0dmFyIHN1YiA9IHt9O1xuXHRcdHN1Ylt2YXJpYWJsZV0gPSBpO1xuXHRcdG5ld0V4cHIgPSBuZXdFeHByLmFkZCh0aGlzRXhwci5ldmFsKHN1Yiwgc2ltcGxpZnkpLCBzaW1wbGlmeSk7XG5cdH1cblx0cmV0dXJuIG5ld0V4cHI7XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdHIgPSBcIlwiO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnRlcm1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciB0ZXJtID0gdGhpcy50ZXJtc1tpXTtcblxuICAgICAgICBzdHIgKz0gKHRlcm0uY29lZmZpY2llbnRzWzBdLnZhbHVlT2YoKSA8IDAgPyBcIiAtIFwiIDogXCIgKyBcIikgKyB0ZXJtLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNvbnN0YW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY29uc3RhbnQgPSB0aGlzLmNvbnN0YW50c1tpXTtcblxuICAgICAgICBzdHIgKz0gKGNvbnN0YW50LnZhbHVlT2YoKSA8IDAgPyBcIiAtIFwiIDogXCIgKyBcIikgKyBjb25zdGFudC5hYnMoKS50b1N0cmluZygpO1xuICAgIH1cblxuICAgIGlmIChzdHIuc3Vic3RyaW5nKDAsIDMpID09PSBcIiAtIFwiKSB7XG4gICAgICAgIHJldHVybiBcIi1cIiArIHN0ci5zdWJzdHJpbmcoMywgc3RyLmxlbmd0aCk7XG4gICAgfSBlbHNlIGlmIChzdHIuc3Vic3RyaW5nKDAsIDMpID09PSBcIiArIFwiKSB7XG4gICAgICAgIHJldHVybiBzdHIuc3Vic3RyaW5nKDMsIHN0ci5sZW5ndGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBcIjBcIjtcbiAgICB9XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS50b1RleCA9IGZ1bmN0aW9uKGRpY3QpIHtcbiAgICB2YXIgc3RyID0gXCJcIjtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy50ZXJtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgdGVybSA9IHRoaXMudGVybXNbaV07XG5cbiAgICAgICAgc3RyICs9ICh0ZXJtLmNvZWZmaWNpZW50c1swXS52YWx1ZU9mKCkgPCAwID8gXCIgLSBcIiA6IFwiICsgXCIpICsgdGVybS50b1RleChkaWN0KTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY29uc3RhbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjb25zdGFudCA9IHRoaXMuY29uc3RhbnRzW2ldO1xuXG4gICAgICAgIHN0ciArPSAoY29uc3RhbnQudmFsdWVPZigpIDwgMCA/IFwiIC0gXCIgOiBcIiArIFwiKSArIGNvbnN0YW50LmFicygpLnRvVGV4KCk7XG4gICAgfVxuXG4gICAgaWYgKHN0ci5zdWJzdHJpbmcoMCwgMykgPT09IFwiIC0gXCIpIHtcbiAgICAgICAgcmV0dXJuIFwiLVwiICsgc3RyLnN1YnN0cmluZygzLCBzdHIubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKHN0ci5zdWJzdHJpbmcoMCwgMykgPT09IFwiICsgXCIpIHtcbiAgICAgICAgcmV0dXJuIHN0ci5zdWJzdHJpbmcoMywgc3RyLmxlbmd0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFwiMFwiO1xuICAgIH1cbn07XG5cbkV4cHJlc3Npb24ucHJvdG90eXBlLl9yZW1vdmVUZXJtc1dpdGhDb2VmZmljaWVudFplcm8gPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnRlcm1zID0gdGhpcy50ZXJtcy5maWx0ZXIoZnVuY3Rpb24odCl7cmV0dXJuIHQuY29lZmZpY2llbnQoKS5yZWR1Y2UoKS5udW1lciAhPT0gMDt9KTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbkV4cHJlc3Npb24ucHJvdG90eXBlLl9jb21iaW5lTGlrZVRlcm1zID0gZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gYWxyZWFkeUVuY291bnRlcmVkKHRlcm0sIGVuY291bnRlcmVkKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW5jb3VudGVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0ZXJtLmNhbkJlQ29tYmluZWRXaXRoKGVuY291bnRlcmVkW2ldKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBuZXdUZXJtcyA9IFtdO1xuICAgIHZhciBlbmNvdW50ZXJlZCA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnRlcm1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciB0aGlzVGVybSA9IHRoaXMudGVybXNbaV07XG5cbiAgICAgICAgaWYgKGFscmVhZHlFbmNvdW50ZXJlZCh0aGlzVGVybSwgZW5jb3VudGVyZWQpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSBpICsgMTsgaiA8IHRoaXMudGVybXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgdGhhdFRlcm0gPSB0aGlzLnRlcm1zW2pdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXNUZXJtLmNhbkJlQ29tYmluZWRXaXRoKHRoYXRUZXJtKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzVGVybSA9IHRoaXNUZXJtLmFkZCh0aGF0VGVybSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXdUZXJtcy5wdXNoKHRoaXNUZXJtKTtcbiAgICAgICAgICAgIGVuY291bnRlcmVkLnB1c2godGhpc1Rlcm0pO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICB0aGlzLnRlcm1zID0gbmV3VGVybXM7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS5fbW92ZVRlcm1zV2l0aERlZ3JlZVplcm9Ub0NvbnN0YW50cyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBrZWVwVGVybXMgPSBbXTtcbiAgICB2YXIgY29uc3RhbnQgPSBuZXcgRnJhY3Rpb24oMCwgMSk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudGVybXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHRoaXNUZXJtID0gdGhpcy50ZXJtc1tpXTtcblxuICAgICAgICBpZiAodGhpc1Rlcm0udmFyaWFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29uc3RhbnQgPSBjb25zdGFudC5hZGQodGhpc1Rlcm0uY29lZmZpY2llbnQoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBrZWVwVGVybXMucHVzaCh0aGlzVGVybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmNvbnN0YW50cy5wdXNoKGNvbnN0YW50KTtcbiAgICB0aGlzLnRlcm1zID0ga2VlcFRlcm1zO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuRXhwcmVzc2lvbi5wcm90b3R5cGUuX3NvcnQgPSBmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBzb3J0VGVybXMoYSwgYikge1xuICAgICAgICB2YXIgeCA9IGEubWF4RGVncmVlKCk7XG4gICAgICAgIHZhciB5ID0gYi5tYXhEZWdyZWUoKTtcblxuICAgICAgICBpZiAoeCA9PT0geSkge1xuICAgICAgICAgICAgdmFyIG0gPSBhLnZhcmlhYmxlcy5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgbiA9IGIudmFyaWFibGVzLmxlbmd0aDtcblxuICAgICAgICAgICAgcmV0dXJuIG4gLSBtO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHkgLSB4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy50ZXJtcyA9IHRoaXMudGVybXMuc29ydChzb3J0VGVybXMpO1xuICAgIHJldHVybiB0aGlzO1xufTtcblxuRXhwcmVzc2lvbi5wcm90b3R5cGUuX2hhc1ZhcmlhYmxlID0gZnVuY3Rpb24odmFyaWFibGUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudGVybXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRoaXMudGVybXNbaV0uaGFzVmFyaWFibGUodmFyaWFibGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbkV4cHJlc3Npb24ucHJvdG90eXBlLl9vbmx5SGFzVmFyaWFibGUgPSBmdW5jdGlvbih2YXJpYWJsZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy50ZXJtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoIXRoaXMudGVybXNbaV0ub25seUhhc1ZhcmlhYmxlKHZhcmlhYmxlKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS5fbm9Dcm9zc1Byb2R1Y3RzV2l0aFZhcmlhYmxlID0gZnVuY3Rpb24odmFyaWFibGUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudGVybXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHRlcm0gPSB0aGlzLnRlcm1zW2ldO1xuICAgICAgICBpZiAodGVybS5oYXNWYXJpYWJsZSh2YXJpYWJsZSkgICYmICF0ZXJtLm9ubHlIYXNWYXJpYWJsZSh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuRXhwcmVzc2lvbi5wcm90b3R5cGUuX25vQ3Jvc3NQcm9kdWN0cyA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy50ZXJtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgdGVybSA9IHRoaXMudGVybXNbaV07XG4gICAgICAgIGlmICh0ZXJtLnZhcmlhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV4cHJlc3Npb24ucHJvdG90eXBlLl9tYXhEZWdyZWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy50ZXJtcy5yZWR1Y2UoZnVuY3Rpb24ocCxjKXtyZXR1cm4gTWF0aC5tYXgocCxjLm1heERlZ3JlZSgpKTt9LDEpO1xufTtcblxuRXhwcmVzc2lvbi5wcm90b3R5cGUuX21heERlZ3JlZU9mVmFyaWFibGUgPSBmdW5jdGlvbih2YXJpYWJsZSkge1xuICAgIHJldHVybiB0aGlzLnRlcm1zLnJlZHVjZShmdW5jdGlvbihwLGMpe3JldHVybiBNYXRoLm1heChwLGMubWF4RGVncmVlT2ZWYXJpYWJsZSh2YXJpYWJsZSkpO30sMSk7XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS5fcXVhZHJhdGljQ29lZmZpY2llbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gVGhpcyBmdW5jdGlvbiBpc24ndCB1c2VkIHVudGlsIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gbW92ZWQgdG8gdGhlIExIUyBpbiBFcXVhdGlvbi5zb2x2ZS5cbiAgICB2YXIgYTtcbiAgICB2YXIgYiA9IG5ldyBGcmFjdGlvbigwLCAxKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudGVybXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHRoaXNUZXJtID0gdGhpcy50ZXJtc1tpXTtcbiAgICAgICAgYSA9ICh0aGlzVGVybS5tYXhEZWdyZWUoKSA9PT0gMikgPyB0aGlzVGVybS5jb2VmZmljaWVudCgpLmNvcHkoKSA6IGE7XG4gICAgICAgIGIgPSAodGhpc1Rlcm0ubWF4RGVncmVlKCkgPT09IDEpID8gdGhpc1Rlcm0uY29lZmZpY2llbnQoKS5jb3B5KCkgOiBiO1xuICAgIH1cbiAgICB2YXIgYyA9IHRoaXMuY29uc3RhbnQoKTtcblxuICAgIHJldHVybiB7YTphLCBiOmIsIGM6Y307XG59O1xuXG5FeHByZXNzaW9uLnByb3RvdHlwZS5fY3ViaWNDb2VmZmljaWVudHMgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzbid0IHVzZWQgdW50aWwgZXZlcnl0aGluZyBoYXMgYmVlbiBtb3ZlZCB0byB0aGUgTEhTIGluIEVxdWF0aW9uLnNvbHZlLlxuICAgIHZhciBhO1xuICAgIHZhciBiID0gbmV3IEZyYWN0aW9uKDAsIDEpO1xuICAgIHZhciBjID0gbmV3IEZyYWN0aW9uKDAsIDEpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnRlcm1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciB0aGlzVGVybSA9IHRoaXMudGVybXNbaV07XG4gICAgICAgIGEgPSAodGhpc1Rlcm0ubWF4RGVncmVlKCkgPT09IDMpID8gdGhpc1Rlcm0uY29lZmZpY2llbnQoKS5jb3B5KCkgOiBhO1xuICAgICAgICBiID0gKHRoaXNUZXJtLm1heERlZ3JlZSgpID09PSAyKSA/IHRoaXNUZXJtLmNvZWZmaWNpZW50KCkuY29weSgpIDogYjtcbiAgICAgICAgYyA9ICh0aGlzVGVybS5tYXhEZWdyZWUoKSA9PT0gMSkgPyB0aGlzVGVybS5jb2VmZmljaWVudCgpLmNvcHkoKSA6IGM7XG4gICAgfVxuXG4gICAgdmFyIGQgPSB0aGlzLmNvbnN0YW50KCk7XG4gICAgcmV0dXJuIHthOmEsIGI6YiwgYzpjLCBkOmR9O1xufTtcblxuVGVybSA9IGZ1bmN0aW9uKHZhcmlhYmxlKSB7XG4gICAgaWYgKHZhcmlhYmxlIGluc3RhbmNlb2YgVmFyaWFibGUpIHtcbiAgICAgICAgdGhpcy52YXJpYWJsZXMgPSBbdmFyaWFibGUuY29weSgpXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZih2YXJpYWJsZSkgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgdGhpcy52YXJpYWJsZXMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyB2YXJpYWJsZS50b1N0cmluZygpICsgXCIpOiBUZXJtIGluaXRpYWxpemVyIG11c3QgYmUgb2YgdHlwZSBWYXJpYWJsZS5cIik7XG4gICAgfVxuXG4gICAgdGhpcy5jb2VmZmljaWVudHMgPSBbbmV3IEZyYWN0aW9uKDEsIDEpXTtcbn07XG5cblRlcm0ucHJvdG90eXBlLmNvZWZmaWNpZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgLy9jYWxjdWxhdGUgdGhlIHByb2R1Y3Qgb2YgYWxsIGNvZWZmaWNpZW50c1xuICAgIHJldHVybiB0aGlzLmNvZWZmaWNpZW50cy5yZWR1Y2UoZnVuY3Rpb24ocCxjKXtyZXR1cm4gcC5tdWx0aXBseShjKTt9LCBuZXcgRnJhY3Rpb24oMSwxKSk7XG59O1xuXG5UZXJtLnByb3RvdHlwZS5zaW1wbGlmeSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb3B5ID0gdGhpcy5jb3B5KCk7XG4gICAgY29weS5jb2VmZmljaWVudHMgPSBbdGhpcy5jb2VmZmljaWVudCgpXTtcbiAgICBjb3B5LmNvbWJpbmVWYXJzKCk7XG4gICAgcmV0dXJuIGNvcHkuc29ydCgpO1xufTtcblxuVGVybS5wcm90b3R5cGUuY29tYmluZVZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdW5pcXVlVmFycyA9IHt9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnZhcmlhYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgdGhpc1ZhciA9IHRoaXMudmFyaWFibGVzW2ldO1xuXG4gICAgICAgIGlmICh0aGlzVmFyLnZhcmlhYmxlIGluIHVuaXF1ZVZhcnMpIHtcbiAgICAgICAgICAgIHVuaXF1ZVZhcnNbdGhpc1Zhci52YXJpYWJsZV0gKz0gdGhpc1Zhci5kZWdyZWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmlxdWVWYXJzW3RoaXNWYXIudmFyaWFibGVdID0gdGhpc1Zhci5kZWdyZWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbmV3VmFycyA9IFtdO1xuXG4gICAgZm9yICh2YXIgdiBpbiB1bmlxdWVWYXJzKSB7XG4gICAgICAgIHZhciBuZXdWYXIgPSBuZXcgVmFyaWFibGUodik7XG4gICAgICAgIG5ld1Zhci5kZWdyZWUgPSB1bmlxdWVWYXJzW3ZdO1xuICAgICAgICBuZXdWYXJzLnB1c2gobmV3VmFyKTtcbiAgICB9XG5cbiAgICB0aGlzLnZhcmlhYmxlcyA9IG5ld1ZhcnM7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5UZXJtLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNvcHkgPSBuZXcgVGVybSgpO1xuICAgIGNvcHkuY29lZmZpY2llbnRzID0gdGhpcy5jb2VmZmljaWVudHMubWFwKGZ1bmN0aW9uKGMpe3JldHVybiBjLmNvcHkoKTt9KTtcbiAgICBjb3B5LnZhcmlhYmxlcyA9IHRoaXMudmFyaWFibGVzLm1hcChmdW5jdGlvbih2KXtyZXR1cm4gdi5jb3B5KCk7fSk7XG4gICAgcmV0dXJuIGNvcHk7XG59O1xuXG5UZXJtLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbih0ZXJtKSB7XG4gICAgaWYodGVybSBpbnN0YW5jZW9mIFRlcm0gJiYgdGhpcy5jYW5CZUNvbWJpbmVkV2l0aCh0ZXJtKSkge1xuICAgICAgICB2YXIgY29weSA9IHRoaXMuY29weSgpO1xuICAgICAgICBjb3B5LmNvZWZmaWNpZW50cyA9IFtjb3B5LmNvZWZmaWNpZW50KCkuYWRkKHRlcm0uY29lZmZpY2llbnQoKSldO1xuICAgICAgICByZXR1cm4gY29weTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyB0ZXJtLnRvU3RyaW5nKCkgKyBcIik6IFN1bW1hbmQgbXVzdCBiZSBvZiB0eXBlIFN0cmluZywgRXhwcmVzc2lvbiwgVGVybSwgRnJhY3Rpb24gb3IgSW50ZWdlci5cIik7XG4gICAgfVxufTtcblxuVGVybS5wcm90b3R5cGUuc3VidHJhY3QgPSBmdW5jdGlvbih0ZXJtKSB7XG4gICAgaWYgKHRlcm0gaW5zdGFuY2VvZiBUZXJtICYmIHRoaXMuY2FuQmVDb21iaW5lZFdpdGgodGVybSkpIHtcbiAgICAgICAgdmFyIGNvcHkgPSB0aGlzLmNvcHkoKTtcbiAgICAgICAgY29weS5jb2VmZmljaWVudHMgPSBbY29weS5jb2VmZmljaWVudCgpLnN1YnRyYWN0KHRlcm0uY29lZmZpY2llbnQoKSldO1xuICAgICAgICByZXR1cm4gY29weTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyB0ZXJtLnRvU3RyaW5nKCkgKyBcIik6IFN1YnRyYWhlbmQgbXVzdCBiZSBvZiB0eXBlIFN0cmluZywgRXhwcmVzc2lvbiwgVGVybSwgRnJhY3Rpb24gb3IgSW50ZWdlci5cIik7XG4gICAgfVxufTtcblxuVGVybS5wcm90b3R5cGUubXVsdGlwbHkgPSBmdW5jdGlvbihhLCBzaW1wbGlmeSkge1xuICAgIHZhciB0aGlzVGVybSA9IHRoaXMuY29weSgpO1xuXG4gICAgaWYgKGEgaW5zdGFuY2VvZiBUZXJtKSB7XG4gICAgICAgIHRoaXNUZXJtLnZhcmlhYmxlcyA9IHRoaXNUZXJtLnZhcmlhYmxlcy5jb25jYXQoYS52YXJpYWJsZXMpO1xuICAgICAgICB0aGlzVGVybS5jb2VmZmljaWVudHMgPSBhLmNvZWZmaWNpZW50cy5jb25jYXQodGhpc1Rlcm0uY29lZmZpY2llbnRzKTtcblxuICAgIH0gZWxzZSBpZiAoaXNJbnQoYSkgfHwgYSBpbnN0YW5jZW9mIEZyYWN0aW9uKSB7XG4gICAgICAgIHZhciBuZXdDb2VmID0gKGlzSW50KGEpID8gbmV3IEZyYWN0aW9uKGEsIDEpIDogYSk7XG5cbiAgICAgICAgaWYgKHRoaXNUZXJtLnZhcmlhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRoaXNUZXJtLmNvZWZmaWNpZW50cy5wdXNoKG5ld0NvZWYpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpc1Rlcm0uY29lZmZpY2llbnRzLnVuc2hpZnQobmV3Q29lZik7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyBhLnRvU3RyaW5nKCkgKyBcIik6IE11bHRpcGxpY2FuZCBtdXN0IGJlIG9mIHR5cGUgU3RyaW5nLCBFeHByZXNzaW9uLCBUZXJtLCBGcmFjdGlvbiBvciBJbnRlZ2VyLlwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gKHNpbXBsaWZ5IHx8IHNpbXBsaWZ5ID09PSB1bmRlZmluZWQpID8gdGhpc1Rlcm0uc2ltcGxpZnkoKSA6IHRoaXNUZXJtO1xufTtcblxuVGVybS5wcm90b3R5cGUuZGl2aWRlID0gZnVuY3Rpb24oYSwgc2ltcGxpZnkpIHtcbiAgICBpZihpc0ludChhKSB8fCBhIGluc3RhbmNlb2YgRnJhY3Rpb24pIHtcbiAgICAgICAgdmFyIHRoaXNUZXJtID0gdGhpcy5jb3B5KCk7XG4gICAgICAgIHRoaXNUZXJtLmNvZWZmaWNpZW50cyA9IHRoaXNUZXJtLmNvZWZmaWNpZW50cy5tYXAoZnVuY3Rpb24oYyl7cmV0dXJuIGMuZGl2aWRlKGEsc2ltcGxpZnkpO30pO1xuICAgICAgICByZXR1cm4gdGhpc1Rlcm07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgQXJndW1lbnQgKFwiICsgYS50b1N0cmluZygpICsgXCIpOiBBcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgRnJhY3Rpb24gb3IgSW50ZWdlci5cIik7XG4gICAgfVxufTtcblxuVGVybS5wcm90b3R5cGUuZXZhbCA9IGZ1bmN0aW9uKHZhbHVlcywgc2ltcGxpZnkpIHtcbiAgICB2YXIgY29weSA9IHRoaXMuY29weSgpO1xuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWVzKTtcbiAgICB2YXIgZXhwID0gY29weS5jb2VmZmljaWVudHMucmVkdWNlKGZ1bmN0aW9uKHAsYyl7cmV0dXJuIHAubXVsdGlwbHkoYyxzaW1wbGlmeSk7fSwgbmV3IEV4cHJlc3Npb24oMSkpO1xuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGNvcHkudmFyaWFibGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciB0aGlzVmFyID0gY29weS52YXJpYWJsZXNbaV07XG5cbiAgICAgICAgdmFyIGV2O1xuXG4gICAgICAgIGlmICh0aGlzVmFyLnZhcmlhYmxlIGluIHZhbHVlcykge1xuICAgICAgICAgICAgdmFyIHN1YiA9IHZhbHVlc1t0aGlzVmFyLnZhcmlhYmxlXTtcblxuICAgICAgICAgICAgaWYoc3ViIGluc3RhbmNlb2YgRnJhY3Rpb24gfHwgc3ViIGluc3RhbmNlb2YgRXhwcmVzc2lvbikge1xuICAgICAgICAgICAgICAgIGV2ID0gc3ViLnBvdyh0aGlzVmFyLmRlZ3JlZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYoaXNJbnQoc3ViKSkge1xuICAgICAgICAgICAgICAgIGV2ID0gTWF0aC5wb3coc3ViLCB0aGlzVmFyLmRlZ3JlZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIEFyZ3VtZW50IChcIiArIHN1YiArIFwiKTogQ2FuIG9ubHkgZXZhbHVhdGUgRXhwcmVzc2lvbnMgb3IgRnJhY3Rpb25zLlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV2ID0gbmV3IEV4cHJlc3Npb24odGhpc1Zhci52YXJpYWJsZSkucG93KHRoaXNWYXIuZGVncmVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cCA9IGV4cC5tdWx0aXBseShldiwgc2ltcGxpZnkpO1xuICAgIH1cblxuICAgIHJldHVybiBleHA7XG59O1xuXG5UZXJtLnByb3RvdHlwZS5oYXNWYXJpYWJsZSA9IGZ1bmN0aW9uKHZhcmlhYmxlKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnZhcmlhYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodGhpcy52YXJpYWJsZXNbaV0udmFyaWFibGUgPT09IHZhcmlhYmxlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cblRlcm0ucHJvdG90eXBlLm1heERlZ3JlZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhcmlhYmxlcy5yZWR1Y2UoZnVuY3Rpb24ocCxjKXtyZXR1cm4gTWF0aC5tYXgocCxjLmRlZ3JlZSk7fSwxKTtcbn07XG5cblRlcm0ucHJvdG90eXBlLm1heERlZ3JlZU9mVmFyaWFibGUgPSBmdW5jdGlvbih2YXJpYWJsZSkge1xuICAgIHJldHVybiB0aGlzLnZhcmlhYmxlcy5yZWR1Y2UoZnVuY3Rpb24ocCxjKXtyZXR1cm4gKGMudmFyaWFibGUgPT09IHZhcmlhYmxlKSA/IE1hdGgubWF4KHAsYy5kZWdyZWUpIDogcDt9LDEpO1xufTtcblxuVGVybS5wcm90b3R5cGUuY2FuQmVDb21iaW5lZFdpdGggPSBmdW5jdGlvbih0ZXJtKSB7XG4gICAgdmFyIHRoaXNWYXJzID0gdGhpcy52YXJpYWJsZXM7XG4gICAgdmFyIHRoYXRWYXJzID0gdGVybS52YXJpYWJsZXM7XG5cbiAgICBpZih0aGlzVmFycy5sZW5ndGggIT0gdGhhdFZhcnMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgbWF0Y2hlcyA9IDA7XG5cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgdGhpc1ZhcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZm9yKHZhciBqID0gMDsgaiA8IHRoYXRWYXJzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZih0aGlzVmFyc1tpXS52YXJpYWJsZSA9PT0gdGhhdFZhcnNbal0udmFyaWFibGUgJiYgdGhpc1ZhcnNbaV0uZGVncmVlID09PSB0aGF0VmFyc1tqXS5kZWdyZWUpIHtcbiAgICAgICAgICAgICAgICBtYXRjaGVzICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gKG1hdGNoZXMgPT09IHRoaXNWYXJzLmxlbmd0aCk7XG59O1xuXG5UZXJtLnByb3RvdHlwZS5vbmx5SGFzVmFyaWFibGUgPSBmdW5jdGlvbih2YXJpYWJsZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy52YXJpYWJsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRoaXMudmFyaWFibGVzW2ldLnZhcmlhYmxlICE9IHZhcmlhYmxlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cblRlcm0ucHJvdG90eXBlLnNvcnQgPSBmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBzb3J0VmFycyhhLCBiKSB7XG4gICAgICAgIHJldHVybiBiLmRlZ3JlZSAtIGEuZGVncmVlO1xuICAgIH1cblxuICAgIHRoaXMudmFyaWFibGVzID0gdGhpcy52YXJpYWJsZXMuc29ydChzb3J0VmFycyk7XG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5UZXJtLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdHIgPSBcIlwiO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNvZWZmaWNpZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY29lZiA9IHRoaXMuY29lZmZpY2llbnRzW2ldO1xuXG4gICAgICAgIGlmIChjb2VmLmFicygpLm51bWVyICE9PSAxIHx8IGNvZWYuYWJzKCkuZGVub20gIT09IDEpIHtcbiAgICAgICAgICAgIHN0ciArPSBcIiAqIFwiICsgY29lZi50b1N0cmluZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RyID0gdGhpcy52YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKHAsYyl7cmV0dXJuIHAuY29uY2F0KGMudG9TdHJpbmcoKSk7fSxzdHIpO1xuICAgIHN0ciA9IChzdHIuc3Vic3RyaW5nKDAsIDMpID09PSBcIiAqIFwiID8gc3RyLnN1YnN0cmluZygzLCBzdHIubGVuZ3RoKSA6IHN0cik7XG4gICAgc3RyID0gKHN0ci5zdWJzdHJpbmcoMCwgMSkgPT09IFwiLVwiID8gc3RyLnN1YnN0cmluZygxLCBzdHIubGVuZ3RoKSA6IHN0cik7XG5cbiAgICByZXR1cm4gc3RyO1xufTtcblxuVGVybS5wcm90b3R5cGUudG9UZXggPSBmdW5jdGlvbihkaWN0KSB7XG4gICAgdmFyIGRpY3QgPSAoZGljdCA9PT0gdW5kZWZpbmVkKSA/IHt9IDogZGljdDtcbiAgICBkaWN0Lm11bHRpcGxpY2F0aW9uID0gIShcIm11bHRpcGxpY2F0aW9uXCIgaW4gZGljdCkgPyBcImNkb3RcIiA6IGRpY3QubXVsdGlwbGljYXRpb247XG4gICAgXG4gICAgdmFyIG9wID0gIFwiIFxcXFxcIiArIGRpY3QubXVsdGlwbGljYXRpb24gKyBcIiBcIjtcblxuICAgIHZhciBzdHIgPSBcIlwiO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNvZWZmaWNpZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY29lZiA9IHRoaXMuY29lZmZpY2llbnRzW2ldO1xuXG4gICAgICAgIGlmIChjb2VmLmFicygpLm51bWVyICE9PSAxIHx8IGNvZWYuYWJzKCkuZGVub20gIT09IDEpIHtcbiAgICAgICAgICAgIHN0ciArPSBvcCArIGNvZWYudG9UZXgoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBzdHIgPSB0aGlzLnZhcmlhYmxlcy5yZWR1Y2UoZnVuY3Rpb24ocCxjKXtyZXR1cm4gcC5jb25jYXQoYy50b1RleCgpKTt9LHN0cik7XG4gICAgc3RyID0gKHN0ci5zdWJzdHJpbmcoMCwgb3AubGVuZ3RoKSA9PT0gb3AgPyBzdHIuc3Vic3RyaW5nKG9wLmxlbmd0aCwgc3RyLmxlbmd0aCkgOiBzdHIpO1xuICAgIHN0ciA9IChzdHIuc3Vic3RyaW5nKDAsIDEpID09PSBcIi1cIiA/IHN0ci5zdWJzdHJpbmcoMSwgc3RyLmxlbmd0aCkgOiBzdHIpO1xuICAgIHN0ciA9IChzdHIuc3Vic3RyaW5nKDAsIDcpID09PSBcIlxcXFxmcmFjey1cIiA/IFwiXFxcXGZyYWN7XCIgKyBzdHIuc3Vic3RyaW5nKDcsIHN0ci5sZW5ndGgpIDogc3RyKTtcblxuICAgIHJldHVybiBzdHI7XG59O1xuXG52YXIgVmFyaWFibGUgPSBmdW5jdGlvbih2YXJpYWJsZSkge1xuICAgIGlmICh0eXBlb2YodmFyaWFibGUpID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHRoaXMudmFyaWFibGUgPSB2YXJpYWJsZTtcbiAgICAgICAgdGhpcy5kZWdyZWUgPSAxO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIEFyZ3VtZW50IChcIiArIHZhcmlhYmxlLnRvU3RyaW5nKCkgKyBcIik6IFZhcmlhYmxlIGluaXRhbGl6ZXIgbXVzdCBiZSBvZiB0eXBlIFN0cmluZy5cIik7XG4gICAgfVxufTtcblxuVmFyaWFibGUucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29weSA9IG5ldyBWYXJpYWJsZSh0aGlzLnZhcmlhYmxlKTtcbiAgICBjb3B5LmRlZ3JlZSA9IHRoaXMuZGVncmVlO1xuICAgIHJldHVybiBjb3B5O1xufTtcblxuVmFyaWFibGUucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGRlZ3JlZSA9IHRoaXMuZGVncmVlO1xuICAgIHZhciB2YXJpYWJsZSA9IHRoaXMudmFyaWFibGU7XG5cbiAgICBpZiAoZGVncmVlID09PSAwKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH0gZWxzZSBpZiAoZGVncmVlID09PSAxKSB7XG4gICAgICAgIHJldHVybiB2YXJpYWJsZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFyaWFibGUgKyBcIl5cIiArIGRlZ3JlZTtcbiAgICB9XG59O1xuXG5WYXJpYWJsZS5wcm90b3R5cGUudG9UZXggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGVncmVlID0gdGhpcy5kZWdyZWU7XG4gICAgdmFyIHZhcmlhYmxlID0gdGhpcy52YXJpYWJsZTtcblxuICAgIGlmIChHUkVFS19MRVRURVJTLmluZGV4T2YodmFyaWFibGUpID4gLTEpIHtcbiAgICAgICAgdmFyaWFibGUgPSBcIlxcXFxcIiArIHZhcmlhYmxlO1xuICAgIH1cblxuICAgIGlmIChkZWdyZWUgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfSBlbHNlIGlmIChkZWdyZWUgPT09IDEpIHtcbiAgICAgICAgcmV0dXJuIHZhcmlhYmxlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YXJpYWJsZSArIFwiXntcIiArIGRlZ3JlZSArIFwifVwiO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEV4cHJlc3Npb246IEV4cHJlc3Npb24sXG4gICAgVGVybTogVGVybSxcbiAgICBWYXJpYWJsZTogVmFyaWFibGVcbn07IiwidmFyIGlzSW50ID0gcmVxdWlyZSgnLi9oZWxwZXInKS5pc0ludDtcbnZhciBnY2QgPSByZXF1aXJlKCcuL2hlbHBlcicpLmdjZDtcbnZhciBsY20gPSByZXF1aXJlKCcuL2hlbHBlcicpLmxjbTtcblxudmFyIEZyYWN0aW9uID0gZnVuY3Rpb24oYSwgYikge1xuICAgIGlmIChiID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFdmFsRXJyb3IoXCJEaXZpZGUgQnkgWmVyb1wiKTtcbiAgICB9IGVsc2UgaWYgKGlzSW50KGEpICYmIGlzSW50KGIpKSB7XG4gICAgICAgIHRoaXMubnVtZXIgPSBhO1xuICAgICAgICB0aGlzLmRlbm9tID0gYjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIrYS50b1N0cmluZygpKyBcIixcIisgYi50b1N0cmluZygpICtcIik6IERpdmlzb3IgYW5kIGRpdmlkZW5kIG11c3QgYmUgb2YgdHlwZSBJbnRlZ2VyLlwiKTtcbiAgICB9XG59O1xuXG5GcmFjdGlvbi5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgRnJhY3Rpb24odGhpcy5udW1lciwgdGhpcy5kZW5vbSk7XG59O1xuXG5GcmFjdGlvbi5wcm90b3R5cGUucmVkdWNlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNvcHkgPSB0aGlzLmNvcHkoKTtcblxuICAgIHZhciBnID0gZ2NkKGNvcHkubnVtZXIsIGNvcHkuZGVub20pO1xuICAgIGNvcHkubnVtZXIgPSBjb3B5Lm51bWVyIC8gZztcbiAgICBjb3B5LmRlbm9tID0gY29weS5kZW5vbSAvIGc7XG5cbiAgICBpZiAoTWF0aC5zaWduKGNvcHkuZGVub20pID09IC0xICYmIE1hdGguc2lnbihjb3B5Lm51bWVyKSA9PSAxKSB7XG4gICAgICAgIGNvcHkubnVtZXIgKj0gLTE7XG4gICAgICAgIGNvcHkuZGVub20gKj0gLTE7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvcHk7XG59O1xuXG5GcmFjdGlvbi5wcm90b3R5cGUuZXF1YWxUbyA9IGZ1bmN0aW9uKGZyYWN0aW9uKSB7XG4gICAgaWYoZnJhY3Rpb24gaW5zdGFuY2VvZiBGcmFjdGlvbikge1xuICAgICAgICB2YXIgdGhpc1JlZHVjZWQgPSB0aGlzLnJlZHVjZSgpO1xuICAgICAgICB2YXIgdGhhdFJlZHVjZWQgPSBmcmFjdGlvbi5yZWR1Y2UoKTtcbiAgICAgICAgcmV0dXJuIHRoaXNSZWR1Y2VkLm51bWVyID09PSB0aGF0UmVkdWNlZC5udW1lciAmJiB0aGlzUmVkdWNlZC5kZW5vbSA9PT0gdGhhdFJlZHVjZWQuZGVub207XG4gICAgfWVsc2V7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59O1xuXG5GcmFjdGlvbi5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oZiwgc2ltcGxpZnkpIHtcbiAgICBzaW1wbGlmeSA9IChzaW1wbGlmeSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHNpbXBsaWZ5KTtcblxuICAgIHZhciBhLCBiO1xuXG4gICAgaWYgKGYgaW5zdGFuY2VvZiBGcmFjdGlvbikge1xuICAgICAgICBhID0gZi5udW1lcjtcbiAgICAgICAgYiA9IGYuZGVub207XG4gICAgfSBlbHNlIGlmIChpc0ludChmKSkge1xuICAgICAgICBhID0gZjtcbiAgICAgICAgYiA9IDE7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgQXJndW1lbnQgKFwiICsgZi50b1N0cmluZygpICsgXCIpOiBTdW1tYW5kIG11c3QgYmUgb2YgdHlwZSBGcmFjdGlvbiBvciBJbnRlZ2VyLlwiKTtcbiAgICB9XG5cbiAgICB2YXIgY29weSA9IHRoaXMuY29weSgpO1xuXG4gICAgaWYgKHRoaXMuZGVub20gPT0gYikge1xuICAgICAgICBjb3B5Lm51bWVyICs9IGE7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG0gPSBsY20oY29weS5kZW5vbSwgYik7XG4gICAgICAgIHZhciB0aGlzTSA9IG0gLyBjb3B5LmRlbm9tO1xuICAgICAgICB2YXIgb3RoZXJNID0gbSAvIGI7XG5cbiAgICAgICAgY29weS5udW1lciAqPSB0aGlzTTtcbiAgICAgICAgY29weS5kZW5vbSAqPSB0aGlzTTtcblxuICAgICAgICBhICo9IG90aGVyTTtcblxuICAgICAgICBjb3B5Lm51bWVyICs9IGE7XG4gICAgfVxuXG4gICAgcmV0dXJuIChzaW1wbGlmeSA/IGNvcHkucmVkdWNlKCkgOiBjb3B5KTtcbn07XG5cbkZyYWN0aW9uLnByb3RvdHlwZS5zdWJ0cmFjdCA9IGZ1bmN0aW9uKGYsIHNpbXBsaWZ5KSB7XG4gICAgc2ltcGxpZnkgPSAoc2ltcGxpZnkgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBzaW1wbGlmeSk7XG5cbiAgICB2YXIgY29weSA9IHRoaXMuY29weSgpO1xuXG4gICAgaWYgKGYgaW5zdGFuY2VvZiBGcmFjdGlvbikge1xuICAgICAgICByZXR1cm4gY29weS5hZGQobmV3IEZyYWN0aW9uKC1mLm51bWVyLCBmLmRlbm9tKSwgc2ltcGxpZnkpO1xuICAgIH0gZWxzZSBpZiAoaXNJbnQoZikpIHtcbiAgICAgICAgcmV0dXJuIGNvcHkuYWRkKG5ldyBGcmFjdGlvbigtZiwgMSksIHNpbXBsaWZ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyBmLnRvU3RyaW5nKCkgKyBcIik6IFN1YnRyYWhlbmQgbXVzdCBiZSBvZiB0eXBlIEZyYWN0aW9uIG9yIEludGVnZXIuXCIpO1xuICAgIH1cbn07XG5cbkZyYWN0aW9uLnByb3RvdHlwZS5tdWx0aXBseSA9IGZ1bmN0aW9uKGYsIHNpbXBsaWZ5KSB7XG4gICAgc2ltcGxpZnkgPSAoc2ltcGxpZnkgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBzaW1wbGlmeSk7XG5cbiAgICB2YXIgYSwgYjtcblxuICAgIGlmIChmIGluc3RhbmNlb2YgRnJhY3Rpb24pIHtcbiAgICAgICAgYSA9IGYubnVtZXI7XG4gICAgICAgIGIgPSBmLmRlbm9tO1xuICAgIH0gZWxzZSBpZiAoaXNJbnQoZikgJiYgZikge1xuICAgICAgICBhID0gZjtcbiAgICAgICAgYiA9IDE7XG4gICAgfSBlbHNlIGlmIChmID09PSAwKSB7XG4gICAgICAgIGEgPSAwO1xuICAgICAgICBiID0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBBcmd1bWVudCAoXCIgKyBmLnRvU3RyaW5nKCkgKyBcIik6IE11bHRpcGxpY2FuZCBtdXN0IGJlIG9mIHR5cGUgRnJhY3Rpb24gb3IgSW50ZWdlci5cIik7XG4gICAgfVxuXG4gICAgdmFyIGNvcHkgPSB0aGlzLmNvcHkoKTtcblxuICAgIGNvcHkubnVtZXIgKj0gYTtcbiAgICBjb3B5LmRlbm9tICo9IGI7XG5cbiAgICByZXR1cm4gKHNpbXBsaWZ5ID8gY29weS5yZWR1Y2UoKSA6IGNvcHkpO1xufTtcblxuRnJhY3Rpb24ucHJvdG90eXBlLmRpdmlkZSA9IGZ1bmN0aW9uKGYsIHNpbXBsaWZ5KSB7XG4gICAgc2ltcGxpZnkgPSAoc2ltcGxpZnkgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBzaW1wbGlmeSk7XG5cbiAgICBpZiAoZi52YWx1ZU9mKCkgPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEV2YWxFcnJvcihcIkRpdmlkZSBCeSBaZXJvXCIpO1xuICAgIH1cblxuICAgIHZhciBjb3B5ID0gdGhpcy5jb3B5KCk7XG5cbiAgICBpZiAoZiBpbnN0YW5jZW9mIEZyYWN0aW9uKSB7XG4gICAgICAgIHJldHVybiBjb3B5Lm11bHRpcGx5KG5ldyBGcmFjdGlvbihmLmRlbm9tLCBmLm51bWVyKSwgc2ltcGxpZnkpO1xuICAgIH0gZWxzZSBpZiAoaXNJbnQoZikpIHtcbiAgICAgICAgcmV0dXJuIGNvcHkubXVsdGlwbHkobmV3IEZyYWN0aW9uKDEsIGYpLCBzaW1wbGlmeSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgQXJndW1lbnQgKFwiICsgZi50b1N0cmluZygpICsgXCIpOiBEaXZpc29yIG11c3QgYmUgb2YgdHlwZSBGcmFjdGlvbiBvciBJbnRlZ2VyLlwiKTtcbiAgICB9XG59O1xuXG5GcmFjdGlvbi5wcm90b3R5cGUucG93ID0gZnVuY3Rpb24obiwgc2ltcGxpZnkpIHtcbiAgICBzaW1wbGlmeSA9IChzaW1wbGlmeSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHNpbXBsaWZ5KTtcblxuICAgIHZhciBjb3B5ID0gdGhpcy5jb3B5KCk7XG5cbiAgICBjb3B5Lm51bWVyID0gTWF0aC5wb3coY29weS5udW1lciwgbik7XG4gICAgY29weS5kZW5vbSA9IE1hdGgucG93KGNvcHkuZGVub20sIG4pO1xuXG4gICAgcmV0dXJuIChzaW1wbGlmeSA/IGNvcHkucmVkdWNlKCkgOiBjb3B5KTtcbn07XG5cbkZyYWN0aW9uLnByb3RvdHlwZS5hYnMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29weSA9IHRoaXMuY29weSgpO1xuXG4gICAgY29weS5udW1lciA9IE1hdGguYWJzKGNvcHkubnVtZXIpO1xuICAgIGNvcHkuZGVub20gPSBNYXRoLmFicyhjb3B5LmRlbm9tKTtcblxuICAgIHJldHVybiBjb3B5O1xufTtcblxuRnJhY3Rpb24ucHJvdG90eXBlLnZhbHVlT2YgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5udW1lciAvIHRoaXMuZGVub207XG59O1xuXG5GcmFjdGlvbi5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5udW1lciA9PT0gMCkge1xuICAgICAgICByZXR1cm4gXCIwXCI7XG4gICAgfSBlbHNlIGlmICh0aGlzLmRlbm9tID09PSAxKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm51bWVyLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmRlbm9tID09PSAtMSkge1xuICAgICAgICByZXR1cm4gKC10aGlzLm51bWVyKS50b1N0cmluZygpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLm51bWVyICsgXCIvXCIgKyB0aGlzLmRlbm9tO1xuICAgIH1cbn07XG5cbkZyYWN0aW9uLnByb3RvdHlwZS50b1RleCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm51bWVyID09PSAwKSB7XG4gICAgICAgIHJldHVybiBcIjBcIjtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZGVub20gPT09IDEpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubnVtZXIudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZGVub20gPT09IC0xKSB7XG4gICAgICAgIHJldHVybiAoLXRoaXMubnVtZXIpLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFwiXFxcXGZyYWN7XCIgKyB0aGlzLm51bWVyICsgXCJ9e1wiICsgdGhpcy5kZW5vbSArIFwifVwiO1xuICAgIH1cbn07XG5cbkZyYWN0aW9uLnByb3RvdHlwZS5fc3F1YXJlUm9vdElzUmF0aW9uYWwgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy52YWx1ZU9mKCkgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgdmFyIHNxcnROdW1lciA9IE1hdGguc3FydCh0aGlzLm51bWVyKTtcbiAgICB2YXIgc3FydERlbm9tID0gTWF0aC5zcXJ0KHRoaXMuZGVub20pO1xuXG4gICAgcmV0dXJuIGlzSW50KHNxcnROdW1lcikgJiYgaXNJbnQoc3FydERlbm9tKTtcbn07XG5cbkZyYWN0aW9uLnByb3RvdHlwZS5fY3ViZVJvb3RJc1JhdGlvbmFsID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMudmFsdWVPZigpID09PSAwKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHZhciBjYnJ0TnVtZXIgPSBNYXRoLmNicnQodGhpcy5udW1lcik7XG4gICAgdmFyIGNicnREZW5vbSA9IE1hdGguY2JydCh0aGlzLmRlbm9tKTtcblxuICAgIHJldHVybiBpc0ludChjYnJ0TnVtZXIpICYmIGlzSW50KGNicnREZW5vbSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZyYWN0aW9uOyIsImZ1bmN0aW9uIGdjZCh4LCB5KSB7XG4gICAgd2hpbGUgKHkpIHtcbiAgICAgICAgdmFyIHRlbXAgPSB4O1xuICAgICAgICB4ID0geTtcbiAgICAgICAgeSA9IHRlbXAgJSB5O1xuICAgIH1cblxuICAgIHJldHVybiB4O1xufVxuXG5mdW5jdGlvbiBsY20oeCwgeSkge1xuICAgIHJldHVybiAoeCAqIHkpIC8gZ2NkKHgsIHkpO1xufVxuXG5mdW5jdGlvbiBpc0ludCh0aGluZykge1xuICAgIHJldHVybiAodHlwZW9mIHRoaW5nID09IFwibnVtYmVyXCIpICYmICh0aGluZyAlIDEgPT09IDApO1xufVxuXG5mdW5jdGlvbiByb3VuZChkZWNpbWFsLCBwbGFjZXMpIHtcbiAgICBwbGFjZXMgPSAodHlwZW9mKHBsYWNlcykgPT09IFwidW5kZWZpbmVkXCIgPyAyIDogcGxhY2VzKTtcbiAgICB2YXIgeCA9IE1hdGgucG93KDEwLCBwbGFjZXMpO1xuICAgIHJldHVybiBNYXRoLnJvdW5kKHBhcnNlRmxvYXQoZGVjaW1hbCkgKiB4KSAvIHg7XG59XG5cbnZhciBHUkVFS19MRVRURVJTID0gW1xuICAgICdhbHBoYScsXG4gICAgJ2JldGEnLFxuICAgICdnYW1tYScsXG4gICAgJ0dhbW1hJyxcbiAgICAnZGVsdGEnLFxuICAgICdEZWx0YScsXG4gICAgJ2Vwc2lsb24nLFxuICAgICd2YXJlcHNpbG9uJyxcbiAgICAnemV0YScsXG4gICAgJ2V0YScsXG4gICAgJ3RoZXRhJyxcbiAgICAndmFydGhldGEnLFxuICAgICdUaGV0YScsXG4gICAgJ2lvdGEnLFxuICAgICdrYXBwYScsXG4gICAgJ2xhbWJkYScsXG4gICAgJ0xhbWJkYScsXG4gICAgJ211JyxcbiAgICAnbnUnLFxuICAgICd4aScsXG4gICAgJ1hpJyxcbiAgICAncGknLFxuICAgICdQaScsXG4gICAgJ3JobycsXG4gICAgJ3ZhcnJobycsXG4gICAgJ3NpZ21hJyxcbiAgICAnU2lnbWEnLFxuICAgICd0YXUnLFxuICAgICd1cHNpbG9uJyxcbiAgICAnVXBzaWxvbicsXG4gICAgJ3BoaScsXG4gICAgJ3ZhcnBoaScsXG4gICAgJ1BoaScsXG4gICAgJ2NoaScsXG4gICAgJ3BzaScsXG4gICAgJ1BzaScsXG4gICAgJ29tZWdhJyxcbiAgICAnT21lZ2EnXG5dO1xuXG5leHBvcnRzLmdjZCA9IGdjZDtcbmV4cG9ydHMubGNtID0gbGNtO1xuZXhwb3J0cy5pc0ludCA9IGlzSW50O1xuZXhwb3J0cy5yb3VuZCA9IHJvdW5kO1xuZXhwb3J0cy5HUkVFS19MRVRURVJTID0gR1JFRUtfTEVUVEVSUzsiLCIndXNlIHN0cmljdCc7XG5cbi8qXG4gIFRoZSBsZXhlciBtb2R1bGUgaXMgYSBzbGlnaHRseSBtb2RpZmllZCB2ZXJzaW9uIG9mIHRoZSBoYW5kd3JpdHRlbiBsZXhlciBieSBFbGkgQmVuZGVyc2t5LlxuICBUaGUgcGFydHMgbm90IG5lZWRlZCBsaWtlIGNvbW1lbnRzIGFuZCBxdW90ZXMgd2VyZSBkZWxldGVkIGFuZCBzb21lIHRoaW5ncyBtb2RpZmllZC5cbiAgQ29tbWVudHMgYXJlIGxlZnQgdW5jaGFuZ2VkLCB0aGUgb3JpZ2luYWwgbGV4ZXIgY2FuIGJlIGZvdW5kIGhlcmU6XG4gIGh0dHA6Ly9lbGkudGhlZ3JlZW5wbGFjZS5uZXQvMjAxMy8wNy8xNi9oYW5kLXdyaXR0ZW4tbGV4ZXItaW4tamF2YXNjcmlwdC1jb21wYXJlZC10by10aGUtcmVnZXgtYmFzZWQtb25lc1xuKi9cblxudmFyIExleGVyID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMucG9zID0gMDtcbiAgdGhpcy5idWYgPSBudWxsO1xuICB0aGlzLmJ1ZmxlbiA9IDA7XG5cbiAgLy8gT3BlcmF0b3IgdGFibGUsIG1hcHBpbmcgb3BlcmF0b3IgLT4gdG9rZW4gbmFtZVxuICB0aGlzLm9wdGFibGUgPSB7XG4gICAgJysnOiAgJ1BMVVMnLFxuICAgICctJzogICdNSU5VUycsXG4gICAgJyonOiAgJ01VTFRJUExZJyxcbiAgICAnLyc6ICAnRElWSURFJyxcbiAgICAnXic6ICAnUE9XRVInLFxuICAgICcoJzogICdMX1BBUkVOJyxcbiAgICAnKSc6ICAnUl9QQVJFTicsXG4gICAgJz0nOiAgJ0VRVUFMUydcbiAgfTtcbn07XG5cbi8vIEluaXRpYWxpemUgdGhlIExleGVyJ3MgYnVmZmVyLiBUaGlzIHJlc2V0cyB0aGUgbGV4ZXIncyBpbnRlcm5hbFxuLy8gc3RhdGUgYW5kIHN1YnNlcXVlbnQgdG9rZW5zIHdpbGwgYmUgcmV0dXJuZWQgc3RhcnRpbmcgd2l0aCB0aGVcbi8vIGJlZ2lubmluZyBvZiB0aGUgbmV3IGJ1ZmZlci5cbkxleGVyLnByb3RvdHlwZS5pbnB1dCA9IGZ1bmN0aW9uKGJ1Zikge1xuICB0aGlzLnBvcyA9IDA7XG4gIHRoaXMuYnVmID0gYnVmO1xuICB0aGlzLmJ1ZmxlbiA9IGJ1Zi5sZW5ndGg7XG59O1xuXG4vLyBHZXQgdGhlIG5leHQgdG9rZW4gZnJvbSB0aGUgY3VycmVudCBidWZmZXIuIEEgdG9rZW4gaXMgYW4gb2JqZWN0IHdpdGhcbi8vIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbi8vIC0gdHlwZTogbmFtZSBvZiB0aGUgcGF0dGVybiB0aGF0IHRoaXMgdG9rZW4gbWF0Y2hlZCAodGFrZW4gZnJvbSBydWxlcykuXG4vLyAtIHZhbHVlOiBhY3R1YWwgc3RyaW5nIHZhbHVlIG9mIHRoZSB0b2tlbi5cbi8vIC0gcG9zOiBvZmZzZXQgaW4gdGhlIGN1cnJlbnQgYnVmZmVyIHdoZXJlIHRoZSB0b2tlbiBzdGFydHMuXG4vL1xuLy8gSWYgdGhlcmUgYXJlIG5vIG1vcmUgdG9rZW5zIGluIHRoZSBidWZmZXIsIHJldHVybnMgbnVsbC4gSW4gY2FzZSBvZlxuLy8gYW4gZXJyb3IgdGhyb3dzIEVycm9yLlxuTGV4ZXIucHJvdG90eXBlLnRva2VuID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX3NraXBub250b2tlbnMoKTtcbiAgaWYgKHRoaXMucG9zID49IHRoaXMuYnVmbGVuKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBUaGUgY2hhciBhdCB0aGlzLnBvcyBpcyBwYXJ0IG9mIGEgcmVhbCB0b2tlbi4gRmlndXJlIG91dCB3aGljaC5cbiAgdmFyIGMgPSB0aGlzLmJ1Zi5jaGFyQXQodGhpcy5wb3MpO1xuICAgLy8gTG9vayBpdCB1cCBpbiB0aGUgdGFibGUgb2Ygb3BlcmF0b3JzXG4gIHZhciBvcCA9IHRoaXMub3B0YWJsZVtjXTtcbiAgaWYgKG9wICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZihvcCA9PT0gJ0xfUEFSRU4nIHx8IG9wID09PSAnUl9QQVJFTicpe1xuICAgICAgIHJldHVybiB7dHlwZTogJ1BBUkVOJywgdmFsdWU6IG9wLCBwb3M6IHRoaXMucG9zKyt9OyAgXG4gICAgfWVsc2V7XG4gICAgICByZXR1cm4ge3R5cGU6ICdPUEVSQVRPUicsIHZhbHVlOiBvcCwgcG9zOiB0aGlzLnBvcysrfTsgIFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBOb3QgYW4gb3BlcmF0b3IgLSBzbyBpdCdzIHRoZSBiZWdpbm5pbmcgb2YgYW5vdGhlciB0b2tlbi5cbiAgICBpZiAoTGV4ZXIuX2lzYWxwaGEoYykpIHtcbiAgICAgIHJldHVybiB0aGlzLl9wcm9jZXNzX2lkZW50aWZpZXIoKTtcbiAgICB9IGVsc2UgaWYgKExleGVyLl9pc2RpZ2l0KGMpKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcHJvY2Vzc19udW1iZXIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKCdUb2tlbiBlcnJvciBhdCBjaGFyYWN0ZXIgJyArIGMgKyAnIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcyk7XG4gICAgfVxuICB9XG59O1xuXG5MZXhlci5faXNkaWdpdCA9IGZ1bmN0aW9uKGMpIHtcbiAgcmV0dXJuIGMgPj0gJzAnICYmIGMgPD0gJzknO1xufTtcblxuTGV4ZXIuX2lzYWxwaGEgPSBmdW5jdGlvbihjKSB7XG4gIHJldHVybiAoYyA+PSAnYScgJiYgYyA8PSAneicpIHx8XG4gICAgICAgICAoYyA+PSAnQScgJiYgYyA8PSAnWicpO1xufTtcblxuTGV4ZXIuX2lzYWxwaGFudW0gPSBmdW5jdGlvbihjKSB7XG4gIHJldHVybiAoYyA+PSAnYScgJiYgYyA8PSAneicpIHx8XG4gICAgICAgICAoYyA+PSAnQScgJiYgYyA8PSAnWicpIHx8XG4gICAgICAgICAoYyA+PSAnMCcgJiYgYyA8PSAnOScpO1xufTtcblxuTGV4ZXIucHJvdG90eXBlLl9wcm9jZXNzX2RpZ2l0cyA9IGZ1bmN0aW9uKHBvc2l0aW9uKXtcbiAgdmFyIGVuZHBvcyA9IHBvc2l0aW9uO1xuICB3aGlsZSAoZW5kcG9zIDwgdGhpcy5idWZsZW4gJiZcbiAgICAgICAgKExleGVyLl9pc2RpZ2l0KHRoaXMuYnVmLmNoYXJBdChlbmRwb3MpKSkpe1xuICAgIGVuZHBvcysrO1xuICB9XG4gIHJldHVybiBlbmRwb3M7XG59O1xuXG5MZXhlci5wcm90b3R5cGUuX3Byb2Nlc3NfbnVtYmVyID0gZnVuY3Rpb24oKSB7XG4gIC8vUmVhZCBjaGFyYWN0ZXJzIHVudGlsIGEgbm9uLWRpZ2l0IGNoYXJhY3RlciBhcHBlYXJzXG4gIHZhciBlbmRwb3MgPSB0aGlzLl9wcm9jZXNzX2RpZ2l0cyh0aGlzLnBvcyk7XG4gIC8vSWYgaXQncyBhIGRlY2ltYWwgcG9pbnQsIGNvbnRpbnVlIHRvIHJlYWQgZGlnaXRzXG4gIGlmKHRoaXMuYnVmLmNoYXJBdChlbmRwb3MpID09PSAnLicpe1xuICAgIGVuZHBvcyA9IHRoaXMuX3Byb2Nlc3NfZGlnaXRzKGVuZHBvcyArIDEpO1xuICB9XG4gIC8vQ2hlY2sgaWYgdGhlIGxhc3QgcmVhZCBjaGFyYWN0ZXIgaXMgYSBkZWNpbWFsIHBvaW50LlxuICAvL0lmIGl0IGlzLCBpZ25vcmUgaXQgYW5kIHByb2NlZWRcbiAgaWYodGhpcy5idWYuY2hhckF0KGVuZHBvcy0xKSA9PT0gJy4nKXtcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJEZWNpbWFsIHBvaW50IHdpdGhvdXQgZGVjaW1hbCBkaWdpdHMgYXQgcG9zaXRpb24gXCIgKyAoZW5kcG9zLTEpKTtcbiAgfSBcbiAgLy9jb25zdHJ1Y3QgdGhlIE5VTUJFUiB0b2tlblxuICB2YXIgdG9rID0ge1xuICAgIHR5cGU6ICdOVU1CRVInLFxuICAgIHZhbHVlOiB0aGlzLmJ1Zi5zdWJzdHJpbmcodGhpcy5wb3MsIGVuZHBvcyksXG4gICAgcG9zOiB0aGlzLnBvc1xuICB9O1xuICB0aGlzLnBvcyA9IGVuZHBvcztcbiAgcmV0dXJuIHRvaztcbn07XG5cbkxleGVyLnByb3RvdHlwZS5fcHJvY2Vzc19pZGVudGlmaWVyID0gZnVuY3Rpb24oKSB7XG4gIHZhciBlbmRwb3MgPSB0aGlzLnBvcyArIDE7XG4gIHdoaWxlIChlbmRwb3MgPCB0aGlzLmJ1ZmxlbiAmJlxuICAgICAgICAgTGV4ZXIuX2lzYWxwaGFudW0odGhpcy5idWYuY2hhckF0KGVuZHBvcykpKSB7XG4gICAgZW5kcG9zKys7XG4gIH1cblxuICB2YXIgdG9rID0ge1xuICAgIHR5cGU6ICdJREVOVElGSUVSJyxcbiAgICB2YWx1ZTogdGhpcy5idWYuc3Vic3RyaW5nKHRoaXMucG9zLCBlbmRwb3MpLFxuICAgIHBvczogdGhpcy5wb3NcbiAgfTtcbiAgdGhpcy5wb3MgPSBlbmRwb3M7XG4gIHJldHVybiB0b2s7XG59O1xuXG5MZXhlci5wcm90b3R5cGUuX3NraXBub250b2tlbnMgPSBmdW5jdGlvbigpIHtcbiAgd2hpbGUgKHRoaXMucG9zIDwgdGhpcy5idWZsZW4pIHtcbiAgICB2YXIgYyA9IHRoaXMuYnVmLmNoYXJBdCh0aGlzLnBvcyk7XG4gICAgaWYgKGMgPT0gJyAnIHx8IGMgPT0gJ1xcdCcgfHwgYyA9PSAnXFxyJyB8fCBjID09ICdcXG4nKSB7XG4gICAgICB0aGlzLnBvcysrO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTGV4ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cblxudmFyIExleGVyID0gcmVxdWlyZSgnLi9sZXhlcicpLFxuICAgIEV4cHJlc3Npb24gPSByZXF1aXJlKCcuL2V4cHJlc3Npb25zJykuRXhwcmVzc2lvbixcbiAgICBGcmFjdGlvbiA9IHJlcXVpcmUoJy4vZnJhY3Rpb25zJyksXG4gICAgRXF1YXRpb24gPSByZXF1aXJlKCcuL2VxdWF0aW9ucycpO1xuXG52YXIgUGFyc2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5sZXhlciA9IG5ldyBMZXhlcigpO1xuICAgIHRoaXMuY3VycmVudF90b2tlbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBCYXNlLWdyYW1tYXI6XG4gICAgICpcbiAgICAgKiBleHByICAgLT4gZXhwciArIHRlcm1cbiAgICAgKiAgICAgICAgfCBleHByIC0gdGVybVxuICAgICAqICAgICAgICB8IC0gdGVybVxuICAgICAqICAgICAgICB8IHRlcm1cbiAgICAgKlxuICAgICAqIHRlcm0gICAtPiB0ZXJtICogZmFjdG9yXG4gICAgICogICAgICAgIHwgdGVybSBmYWN0b3JcbiAgICAgKiAgICAgICAgfCB0ZXJtIC8gZmFjdG9yXG4gICAgICogICAgICAgIHwgdGVybSBeIGZhY3RvclxuICAgICAqICAgICAgICB8IGZhY3RvclxuICAgICAqXG4gICAgICogZmFjdG9yIC0+IChleHByKVxuICAgICAqICAgICAgICB8IG51bVxuICAgICAqICAgICAgICB8IGlkXG4gICAgICpcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICpcbiAgICAgKiBHcmFtbWFyIHdpdGhvdXQgbGVmdCByZWN1cnNpb24gLT4gdGhlIGdyYW1tYXIgYWN0dWFsbHkgdXNlZFxuICAgICAqXG4gICAgICogZXFuICAgICAgICAgLT4gZXhwciA9IGV4cHJcbiAgICAgKiBleHByICAgICAgICAtPiB0ZXJtIGV4cHJfcmVzdFxuICAgICAqIGV4cHJfcmVzdCAgIC0+ICsgdGVybSBleHByX3Jlc3RcbiAgICAgKiAgICAgICAgICAgICB8IC0gdGVybSBleHByX3Jlc3RcbiAgICAgKiAgICAgICAgICAgICB8IM61XG4gICAgICpcbiAgICAgKiB0ZXJtICAgICAgICAtPiBmYWN0b3IgdGVybV9yZXN0XG4gICAgICogdGVybV9yZXN0ICAgLT4gKiB0ZXJtIHRlcm1fcmVzdFxuICAgICAqICAgICAgICAgICAgIHwgICB0ZXJtIHRlcm1fcmVzdFxuICAgICAqICAgICAgICAgICAgIHwgXiB0ZXJtIHRlcm1fcmVzdFxuICAgICAqICAgICAgICAgICAgIHwgLyB0ZXJtIHRlcm1fcmVzdFxuICAgICAqICAgICAgICAgICAgIHwgzrVcbiAgICAgKlxuICAgICAqIGZhY3RvciAgICAgIC0+IChleHByKVxuICAgICAqICAgICAgICAgICAgIHwgbnVtXG4gICAgICogICAgICAgICAgICAgfCBpZFxuICAgICAqXG4gICAgICoqL1xufTtcblxuLy8gVXBkYXRlcyB0aGUgY3VycmVudCB0b2tlbiB0byB0aGUgbmV4dCBpbnB1dCB0b2tlbiBcblBhcnNlci5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jdXJyZW50X3Rva2VuID0gdGhpcy5sZXhlci50b2tlbigpO1xufTtcblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBjdXJyZW50IHRva2VuIG1hdGNoZXMgdGhlIGtleXdvcmRcblBhcnNlci5wcm90b3R5cGUubWF0Y2ggPSBmdW5jdGlvbihrZXl3b3JkKSB7XG4gICAgaWYgKHRoaXMuY3VycmVudF90b2tlbiA9PT0gbnVsbCkgcmV0dXJuIGtleXdvcmQgPT09ICdlcHNpbG9uJztcblxuICAgIHN3aXRjaCAoa2V5d29yZCkge1xuICAgICAgICBjYXNlICdwbHVzJzpcbiAgICAgICAgICAgIHJldHVybiAoKHRoaXMuY3VycmVudF90b2tlbi50eXBlID09PSAnT1BFUkFUT1InKSAmJiAodGhpcy5jdXJyZW50X3Rva2VuLnZhbHVlID09PSAnUExVUycpKTtcbiAgICAgICAgY2FzZSAnbWludXMnOlxuICAgICAgICAgICAgcmV0dXJuICgodGhpcy5jdXJyZW50X3Rva2VuLnR5cGUgPT09ICdPUEVSQVRPUicpICYmICh0aGlzLmN1cnJlbnRfdG9rZW4udmFsdWUgPT09ICdNSU5VUycpKTtcbiAgICAgICAgY2FzZSAnbXVsdGlwbHknOlxuICAgICAgICAgICAgcmV0dXJuICgodGhpcy5jdXJyZW50X3Rva2VuLnR5cGUgPT09ICdPUEVSQVRPUicpICYmICh0aGlzLmN1cnJlbnRfdG9rZW4udmFsdWUgPT09ICdNVUxUSVBMWScpKTtcbiAgICAgICAgY2FzZSAncG93ZXInOlxuICAgICAgICAgICAgcmV0dXJuICgodGhpcy5jdXJyZW50X3Rva2VuLnR5cGUgPT09ICdPUEVSQVRPUicpICYmICh0aGlzLmN1cnJlbnRfdG9rZW4udmFsdWUgPT09ICdQT1dFUicpKTtcbiAgICAgICAgY2FzZSAnZGl2aWRlJzpcbiAgICAgICAgICAgIHJldHVybiAoKHRoaXMuY3VycmVudF90b2tlbi50eXBlID09PSAnT1BFUkFUT1InKSAmJiAodGhpcy5jdXJyZW50X3Rva2VuLnZhbHVlID09PSAnRElWSURFJykpO1xuICAgICAgICBjYXNlICdlcXVhbCc6XG4gICAgICAgICAgICByZXR1cm4gKCh0aGlzLmN1cnJlbnRfdG9rZW4udHlwZSA9PT0gJ09QRVJBVE9SJykgJiYgKHRoaXMuY3VycmVudF90b2tlbi52YWx1ZSA9PT0gJ0VRVUFMUycpKTtcbiAgICAgICAgY2FzZSAnbHBhcmVuJzpcbiAgICAgICAgICAgIHJldHVybiAoKHRoaXMuY3VycmVudF90b2tlbi50eXBlID09PSAnUEFSRU4nKSAmJiAodGhpcy5jdXJyZW50X3Rva2VuLnZhbHVlID09PSAnTF9QQVJFTicpKTtcbiAgICAgICAgY2FzZSAncnBhcmVuJzpcbiAgICAgICAgICAgIHJldHVybiAoKHRoaXMuY3VycmVudF90b2tlbi50eXBlID09PSAnUEFSRU4nKSAmJiAodGhpcy5jdXJyZW50X3Rva2VuLnZhbHVlID09PSAnUl9QQVJFTicpKTtcbiAgICAgICAgY2FzZSAnbnVtJzpcbiAgICAgICAgICAgIHJldHVybiAodGhpcy5jdXJyZW50X3Rva2VuLnR5cGUgPT09ICdOVU1CRVInKTtcbiAgICAgICAgY2FzZSAnaWQnOlxuICAgICAgICAgICAgcmV0dXJuICh0aGlzLmN1cnJlbnRfdG9rZW4udHlwZSA9PT0gJ0lERU5USUZJRVInKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59O1xuXG4vKlxuICAgIEluaXRpYWxpemVzIHRoZSBwYXJzZXIgaW50ZXJuYWxzIGFuZCB0aGUgbGV4ZXIuXG4gICAgVGhlIGlucHV0IGlzIHRoZW4gcGFyc2VkIGFjY29yZGluZyB0byB0aGUgZ3JhbW1hciBkZXNjcmliZWQgaW4gdGhlXG4gICAgaGVhZGVyIGNvbW1lbnQuIFRoZSBwYXJzaW5nIHByb2Nlc3MgY29uc3RydWN0cyBhIGFic3RyYWN0IHN5bnRheCB0cmVlXG4gICAgdXNpbmcgdGhlIGNsYXNzZXMgdGhlIGFsZ2VicmEuanMgbGlicmFyeSBwcm92aWRlc1xuKi9cblBhcnNlci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbihpbnB1dCkge1xuICAgIC8vcGFzcyB0aGUgaW5wdXQgdG8gdGhlIGxleGVyXG4gICAgdGhpcy5sZXhlci5pbnB1dChpbnB1dCk7XG4gICAgdGhpcy51cGRhdGUoKTtcbiAgICByZXR1cm4gdGhpcy5wYXJzZUVxbigpO1xufTtcblxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZUVxbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBleDEgPSB0aGlzLnBhcnNlRXhwcigpO1xuICAgIGlmICh0aGlzLm1hdGNoKCdlcXVhbCcpKSB7XG4gICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgIHZhciBleDIgPSB0aGlzLnBhcnNlRXhwcigpO1xuICAgICAgICByZXR1cm4gbmV3IEVxdWF0aW9uKGV4MSxleDIpO1xuICAgIH1lbHNlIGlmKHRoaXMubWF0Y2goJ2Vwc2lsb24nKSl7XG4gICAgICAgIHJldHVybiBleDE7XG4gICAgfWVsc2V7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcignVW5iYWxhbmNlZCBQYXJlbnRoZXNpcycpO1xuICAgIH1cbn07XG5cblBhcnNlci5wcm90b3R5cGUucGFyc2VFeHByID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRlcm0gPSB0aGlzLnBhcnNlVGVybSgpO1xuICAgIHJldHVybiB0aGlzLnBhcnNlRXhwclJlc3QodGVybSk7XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLnBhcnNlRXhwclJlc3QgPSBmdW5jdGlvbih0ZXJtKSB7XG4gICAgaWYgKHRoaXMubWF0Y2goJ3BsdXMnKSkge1xuICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICB2YXIgcGx1c3Rlcm0gPSB0aGlzLnBhcnNlVGVybSgpO1xuICAgICAgICBpZih0ZXJtID09PSB1bmRlZmluZWQgfHwgcGx1c3Rlcm0gPT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IFN5bnRheEVycm9yKCdNaXNzaW5nIG9wZXJhbmQnKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VFeHByUmVzdCh0ZXJtLmFkZChwbHVzdGVybSkpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5tYXRjaCgnbWludXMnKSkge1xuICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICB2YXIgbWludXN0ZXJtID0gdGhpcy5wYXJzZVRlcm0oKTtcbiAgICAgICAgLy9UaGlzIGNhc2UgaXMgZW50ZXJlZCB3aGVuIGEgbmVnYXRpdmUgbnVtYmVyIGlzIHBhcnNlZCBlLmcuIHggPSAtNFxuICAgICAgICBpZiAodGVybSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZUV4cHJSZXN0KG1pbnVzdGVybS5tdWx0aXBseSgtMSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VFeHByUmVzdCh0ZXJtLnN1YnRyYWN0KG1pbnVzdGVybSkpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRlcm07XG4gICAgfVxufTtcblxuXG5QYXJzZXIucHJvdG90eXBlLnBhcnNlVGVybSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmYWN0b3IgPSB0aGlzLnBhcnNlRmFjdG9yKCk7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VUZXJtUmVzdChmYWN0b3IpO1xufTtcblxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZVRlcm1SZXN0ID0gZnVuY3Rpb24oZmFjdG9yKSB7XG4gICAgaWYgKHRoaXMubWF0Y2goJ211bHRpcGx5JykpIHtcbiAgICAgICAgdGhpcy51cGRhdGUoKTtcbiAgICAgICAgdmFyIG11bGZhY3RvciA9IHRoaXMucGFyc2VGYWN0b3IoKTtcbiAgICAgICAgcmV0dXJuIGZhY3Rvci5tdWx0aXBseSh0aGlzLnBhcnNlVGVybVJlc3QobXVsZmFjdG9yKSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoKCdwb3dlcicpKSB7XG4gICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgIHZhciBwb3dmYWN0b3IgPSB0aGlzLnBhcnNlRmFjdG9yKCk7XG4gICAgICAgIC8vV09SS0FST1VORDogYWxnZWJyYS5qcyBvbmx5IGFsbG93cyBpbnRlZ2VycyBhbmQgZnJhY3Rpb25zIGZvciByYWlzaW5nXG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlVGVybVJlc3QoZmFjdG9yLnBvdyhwYXJzZUludChwb3dmYWN0b3IudG9TdHJpbmcoKSkpKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2goJ2RpdmlkZScpKSB7XG4gICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgIHZhciBkZXZmYWN0b3IgPSB0aGlzLnBhcnNlRmFjdG9yKCk7XG4gICAgICAgIC8vV09SS0FST1VORDogYWxnZWJyYS5qcyBvbmx5IGFsbG93cyBpbnRlZ2VycyBhbmQgZnJhY3Rpb25zIGZvciBkaXZpc2lvblxuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZVRlcm1SZXN0KGZhY3Rvci5kaXZpZGUodGhpcy5jb252ZXJ0VG9GcmFjdGlvbihkZXZmYWN0b3IpKSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoKCdlcHNpbG9uJykpIHtcbiAgICAgICAgcmV0dXJuIGZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvL2EgbWlzc2luZyBvcGVyYXRvciBiZXR3ZWVuIHRlcm1zIGlzIHRyZWF0ZWQgbGlrZSBhIG11bHRpcGxpZXJcbiAgICAgICAgdmFyIG11bGZhY3RvcjIgPSB0aGlzLnBhcnNlRmFjdG9yKCk7XG4gICAgICAgIGlmIChtdWxmYWN0b3IyID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWN0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFjdG9yLm11bHRpcGx5KHRoaXMucGFyc2VUZXJtUmVzdChtdWxmYWN0b3IyKSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIElzIHVzZWQgdG8gY29udmVydCBleHByZXNzaW9ucyB0byBmcmFjdGlvbnMsIGFzIGRpdmlkaW5nIGJ5IGV4cHJlc3Npb25zIGlzIG5vdCBwb3NzaWJsZVxuKiovXG5QYXJzZXIucHJvdG90eXBlLmNvbnZlcnRUb0ZyYWN0aW9uID0gZnVuY3Rpb24oZXhwcmVzc2lvbikge1xuICAgIGlmKGV4cHJlc3Npb24udGVybXMubGVuZ3RoID4gMCl7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgQXJndW1lbnQgKCcgKyBleHByZXNzaW9uLnRvU3RyaW5nKCkgKyAnKTogRGl2aXNvciBtdXN0IGJlIG9mIHR5cGUgSW50ZWdlciBvciBGcmFjdGlvbi4nKTtcbiAgICB9ZWxzZXtcbiAgICAgICAgdmFyIGMgPSBleHByZXNzaW9uLmNvbnN0YW50c1swXTtcbiAgICAgICAgcmV0dXJuIG5ldyBGcmFjdGlvbihjLm51bWVyLCBjLmRlbm9tKTtcbiAgICB9XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLnBhcnNlRmFjdG9yID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMubWF0Y2goJ251bScpKSB7XG4gICAgICAgIHZhciBudW0gPSB0aGlzLnBhcnNlTnVtYmVyKCk7XG4gICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgIHJldHVybiBudW07XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoKCdpZCcpKSB7XG4gICAgICAgIHZhciBpZCA9IG5ldyBFeHByZXNzaW9uKHRoaXMuY3VycmVudF90b2tlbi52YWx1ZSk7XG4gICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgIHJldHVybiBpZDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2goJ2xwYXJlbicpKSB7XG4gICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgIHZhciBleHByID0gdGhpcy5wYXJzZUV4cHIoKTtcbiAgICAgICAgaWYgKHRoaXMubWF0Y2goJ3JwYXJlbicpKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICAgICAgcmV0dXJuIGV4cHI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoJ1VuYmFsYW5jZWQgUGFyZW50aGVzaXMnKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufTtcblxuLy8gQ29udmVydHMgYSBudW1iZXIgdG9rZW4gLSBpbnRlZ2VyIG9yIGRlY2ltYWwgLSB0byBhbiBleHByZXNzaW9uXG5QYXJzZXIucHJvdG90eXBlLnBhcnNlTnVtYmVyID0gZnVuY3Rpb24oKSB7XG4gICAgIC8vSW50ZWdlciBjb252ZXJzaW9uXG4gICAgaWYocGFyc2VJbnQodGhpcy5jdXJyZW50X3Rva2VuLnZhbHVlKSA9PSB0aGlzLmN1cnJlbnRfdG9rZW4udmFsdWUpe1xuICAgICAgICByZXR1cm4gbmV3IEV4cHJlc3Npb24ocGFyc2VJbnQodGhpcy5jdXJyZW50X3Rva2VuLnZhbHVlKSk7ICAgICAgXG4gICAgfWVsc2V7XG4gICAgICAgIC8vU3BsaXQgdGhlIGRlY2ltYWwgbnVtYmVyIHRvIGludGVnZXIgYW5kIGRlY2ltYWwgcGFydHNcbiAgICAgICAgdmFyIHNwbGl0cyA9IHRoaXMuY3VycmVudF90b2tlbi52YWx1ZS5zcGxpdCgnLicpO1xuICAgICAgICAvL2NvdW50IHRoZSBkaWdpdHMgb2YgdGhlIGRlY2ltYWwgcGFydFxuICAgICAgICB2YXIgZGVjaW1hbHMgPSBzcGxpdHNbMV0ubGVuZ3RoO1xuICAgICAgICAvL2RldGVybWluZSB0aGUgbXVsdGlwbGljYXRpb24gZmFjdG9yXG4gICAgICAgIHZhciBmYWN0b3IgPSBNYXRoLnBvdygxMCxkZWNpbWFscyk7XG4gICAgICAgIHZhciBmbG9hdF9vcCA9IHBhcnNlRmxvYXQodGhpcy5jdXJyZW50X3Rva2VuLnZhbHVlKTtcbiAgICAgICAgLy9tdWx0aXBseSB0aGUgZmxvYXQgd2l0aCB0aGUgZmFjdG9yIGFuZCBkaXZpZGUgaXQgYWdhaW4gYWZ0ZXJ3YXJkcyBcbiAgICAgICAgLy90byBjcmVhdGUgYSB2YWxpZCBleHByZXNzaW9uIG9iamVjdFxuICAgICAgICByZXR1cm4gbmV3IEV4cHJlc3Npb24ocGFyc2VJbnQoZmxvYXRfb3AgKiBmYWN0b3IpKS5kaXZpZGUoZmFjdG9yKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnNlcjtcbiIsInZhciByb290ID0gcmVxdWlyZSgnLi9fcm9vdCcpO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBTeW1ib2wgPSByb290LlN5bWJvbDtcblxubW9kdWxlLmV4cG9ydHMgPSBTeW1ib2w7XG4iLCJ2YXIgU3ltYm9sID0gcmVxdWlyZSgnLi9fU3ltYm9sJyksXG4gICAgZ2V0UmF3VGFnID0gcmVxdWlyZSgnLi9fZ2V0UmF3VGFnJyksXG4gICAgb2JqZWN0VG9TdHJpbmcgPSByZXF1aXJlKCcuL19vYmplY3RUb1N0cmluZycpO1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgbnVsbFRhZyA9ICdbb2JqZWN0IE51bGxdJyxcbiAgICB1bmRlZmluZWRUYWcgPSAnW29iamVjdCBVbmRlZmluZWRdJztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgc3ltVG9TdHJpbmdUYWcgPSBTeW1ib2wgPyBTeW1ib2wudG9TdHJpbmdUYWcgOiB1bmRlZmluZWQ7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYGdldFRhZ2Agd2l0aG91dCBmYWxsYmFja3MgZm9yIGJ1Z2d5IGVudmlyb25tZW50cy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBgdG9TdHJpbmdUYWdgLlxuICovXG5mdW5jdGlvbiBiYXNlR2V0VGFnKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWRUYWcgOiBudWxsVGFnO1xuICB9XG4gIHJldHVybiAoc3ltVG9TdHJpbmdUYWcgJiYgc3ltVG9TdHJpbmdUYWcgaW4gT2JqZWN0KHZhbHVlKSlcbiAgICA/IGdldFJhd1RhZyh2YWx1ZSlcbiAgICA6IG9iamVjdFRvU3RyaW5nKHZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiYXNlR2V0VGFnO1xuIiwiLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cbnZhciBmcmVlR2xvYmFsID0gdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWwgJiYgZ2xvYmFsLk9iamVjdCA9PT0gT2JqZWN0ICYmIGdsb2JhbDtcblxubW9kdWxlLmV4cG9ydHMgPSBmcmVlR2xvYmFsO1xuIiwidmFyIG92ZXJBcmcgPSByZXF1aXJlKCcuL19vdmVyQXJnJyk7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIGdldFByb3RvdHlwZSA9IG92ZXJBcmcoT2JqZWN0LmdldFByb3RvdHlwZU9mLCBPYmplY3QpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFByb3RvdHlwZTtcbiIsInZhciBTeW1ib2wgPSByZXF1aXJlKCcuL19TeW1ib2wnKTtcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlXG4gKiBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNy4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG5hdGl2ZU9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIHN5bVRvU3RyaW5nVGFnID0gU3ltYm9sID8gU3ltYm9sLnRvU3RyaW5nVGFnIDogdW5kZWZpbmVkO1xuXG4vKipcbiAqIEEgc3BlY2lhbGl6ZWQgdmVyc2lvbiBvZiBgYmFzZUdldFRhZ2Agd2hpY2ggaWdub3JlcyBgU3ltYm9sLnRvU3RyaW5nVGFnYCB2YWx1ZXMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHF1ZXJ5LlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgcmF3IGB0b1N0cmluZ1RhZ2AuXG4gKi9cbmZ1bmN0aW9uIGdldFJhd1RhZyh2YWx1ZSkge1xuICB2YXIgaXNPd24gPSBoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCBzeW1Ub1N0cmluZ1RhZyksXG4gICAgICB0YWcgPSB2YWx1ZVtzeW1Ub1N0cmluZ1RhZ107XG5cbiAgdHJ5IHtcbiAgICB2YWx1ZVtzeW1Ub1N0cmluZ1RhZ10gPSB1bmRlZmluZWQ7XG4gICAgdmFyIHVubWFza2VkID0gdHJ1ZTtcbiAgfSBjYXRjaCAoZSkge31cblxuICB2YXIgcmVzdWx0ID0gbmF0aXZlT2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIGlmICh1bm1hc2tlZCkge1xuICAgIGlmIChpc093bikge1xuICAgICAgdmFsdWVbc3ltVG9TdHJpbmdUYWddID0gdGFnO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgdmFsdWVbc3ltVG9TdHJpbmdUYWddO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFJhd1RhZztcbiIsIi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZVxuICogW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzcuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBuYXRpdmVPYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYSBzdHJpbmcgdXNpbmcgYE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjb252ZXJ0LlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29udmVydGVkIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIG5hdGl2ZU9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG9iamVjdFRvU3RyaW5nO1xuIiwiLyoqXG4gKiBDcmVhdGVzIGEgdW5hcnkgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGBmdW5jYCB3aXRoIGl0cyBhcmd1bWVudCB0cmFuc2Zvcm1lZC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gd3JhcC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHRyYW5zZm9ybSBUaGUgYXJndW1lbnQgdHJhbnNmb3JtLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG92ZXJBcmcoZnVuYywgdHJhbnNmb3JtKSB7XG4gIHJldHVybiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gZnVuYyh0cmFuc2Zvcm0oYXJnKSk7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gb3ZlckFyZztcbiIsInZhciBmcmVlR2xvYmFsID0gcmVxdWlyZSgnLi9fZnJlZUdsb2JhbCcpO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHNlbGZgLiAqL1xudmFyIGZyZWVTZWxmID0gdHlwZW9mIHNlbGYgPT0gJ29iamVjdCcgJiYgc2VsZiAmJiBzZWxmLk9iamVjdCA9PT0gT2JqZWN0ICYmIHNlbGY7XG5cbi8qKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0LiAqL1xudmFyIHJvb3QgPSBmcmVlR2xvYmFsIHx8IGZyZWVTZWxmIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gcm9vdDtcbiIsIi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuIEEgdmFsdWUgaXMgb2JqZWN0LWxpa2UgaWYgaXQncyBub3QgYG51bGxgXG4gKiBhbmQgaGFzIGEgYHR5cGVvZmAgcmVzdWx0IG9mIFwib2JqZWN0XCIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSA0LjAuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdExpa2Uoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc09iamVjdExpa2UobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzT2JqZWN0TGlrZTtcbiIsInZhciBiYXNlR2V0VGFnID0gcmVxdWlyZSgnLi9fYmFzZUdldFRhZycpLFxuICAgIGdldFByb3RvdHlwZSA9IHJlcXVpcmUoJy4vX2dldFByb3RvdHlwZScpLFxuICAgIGlzT2JqZWN0TGlrZSA9IHJlcXVpcmUoJy4vaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RUYWcgPSAnW29iamVjdCBPYmplY3RdJztcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZSxcbiAgICBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGRlY29tcGlsZWQgc291cmNlIG9mIGZ1bmN0aW9ucy4gKi9cbnZhciBmdW5jVG9TdHJpbmcgPSBmdW5jUHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBVc2VkIHRvIGluZmVyIHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3Rvci4gKi9cbnZhciBvYmplY3RDdG9yU3RyaW5nID0gZnVuY1RvU3RyaW5nLmNhbGwoT2JqZWN0KTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHBsYWluIG9iamVjdCwgdGhhdCBpcywgYW4gb2JqZWN0IGNyZWF0ZWQgYnkgdGhlXG4gKiBgT2JqZWN0YCBjb25zdHJ1Y3RvciBvciBvbmUgd2l0aCBhIGBbW1Byb3RvdHlwZV1dYCBvZiBgbnVsbGAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSAwLjguMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogfVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdChuZXcgRm9vKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc1BsYWluT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdCh7ICd4JzogMCwgJ3knOiAwIH0pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdChPYmplY3QuY3JlYXRlKG51bGwpKTtcbiAqIC8vID0+IHRydWVcbiAqL1xuZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICBpZiAoIWlzT2JqZWN0TGlrZSh2YWx1ZSkgfHwgYmFzZUdldFRhZyh2YWx1ZSkgIT0gb2JqZWN0VGFnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciBwcm90byA9IGdldFByb3RvdHlwZSh2YWx1ZSk7XG4gIGlmIChwcm90byA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHZhciBDdG9yID0gaGFzT3duUHJvcGVydHkuY2FsbChwcm90bywgJ2NvbnN0cnVjdG9yJykgJiYgcHJvdG8uY29uc3RydWN0b3I7XG4gIHJldHVybiB0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IgaW5zdGFuY2VvZiBDdG9yICYmXG4gICAgZnVuY1RvU3RyaW5nLmNhbGwoQ3RvcikgPT0gb2JqZWN0Q3RvclN0cmluZztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1BsYWluT2JqZWN0O1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxudmFyIF9leHRlbmRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0KSB7IGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7IHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07IGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHsgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTsgfSB9IH0gcmV0dXJuIHRhcmdldDsgfTtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gYXBwbHlNaWRkbGV3YXJlO1xuXG52YXIgX2NvbXBvc2UgPSByZXF1aXJlKCcuL2NvbXBvc2UnKTtcblxudmFyIF9jb21wb3NlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NvbXBvc2UpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9XG5cbi8qKlxuICogQ3JlYXRlcyBhIHN0b3JlIGVuaGFuY2VyIHRoYXQgYXBwbGllcyBtaWRkbGV3YXJlIHRvIHRoZSBkaXNwYXRjaCBtZXRob2RcbiAqIG9mIHRoZSBSZWR1eCBzdG9yZS4gVGhpcyBpcyBoYW5keSBmb3IgYSB2YXJpZXR5IG9mIHRhc2tzLCBzdWNoIGFzIGV4cHJlc3NpbmdcbiAqIGFzeW5jaHJvbm91cyBhY3Rpb25zIGluIGEgY29uY2lzZSBtYW5uZXIsIG9yIGxvZ2dpbmcgZXZlcnkgYWN0aW9uIHBheWxvYWQuXG4gKlxuICogU2VlIGByZWR1eC10aHVua2AgcGFja2FnZSBhcyBhbiBleGFtcGxlIG9mIHRoZSBSZWR1eCBtaWRkbGV3YXJlLlxuICpcbiAqIEJlY2F1c2UgbWlkZGxld2FyZSBpcyBwb3RlbnRpYWxseSBhc3luY2hyb25vdXMsIHRoaXMgc2hvdWxkIGJlIHRoZSBmaXJzdFxuICogc3RvcmUgZW5oYW5jZXIgaW4gdGhlIGNvbXBvc2l0aW9uIGNoYWluLlxuICpcbiAqIE5vdGUgdGhhdCBlYWNoIG1pZGRsZXdhcmUgd2lsbCBiZSBnaXZlbiB0aGUgYGRpc3BhdGNoYCBhbmQgYGdldFN0YXRlYCBmdW5jdGlvbnNcbiAqIGFzIG5hbWVkIGFyZ3VtZW50cy5cbiAqXG4gKiBAcGFyYW0gey4uLkZ1bmN0aW9ufSBtaWRkbGV3YXJlcyBUaGUgbWlkZGxld2FyZSBjaGFpbiB0byBiZSBhcHBsaWVkLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBBIHN0b3JlIGVuaGFuY2VyIGFwcGx5aW5nIHRoZSBtaWRkbGV3YXJlLlxuICovXG5mdW5jdGlvbiBhcHBseU1pZGRsZXdhcmUoKSB7XG4gIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBtaWRkbGV3YXJlcyA9IEFycmF5KF9sZW4pLCBfa2V5ID0gMDsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgIG1pZGRsZXdhcmVzW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIChjcmVhdGVTdG9yZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAocmVkdWNlciwgcHJlbG9hZGVkU3RhdGUsIGVuaGFuY2VyKSB7XG4gICAgICB2YXIgc3RvcmUgPSBjcmVhdGVTdG9yZShyZWR1Y2VyLCBwcmVsb2FkZWRTdGF0ZSwgZW5oYW5jZXIpO1xuICAgICAgdmFyIF9kaXNwYXRjaCA9IHN0b3JlLmRpc3BhdGNoO1xuICAgICAgdmFyIGNoYWluID0gW107XG5cbiAgICAgIHZhciBtaWRkbGV3YXJlQVBJID0ge1xuICAgICAgICBnZXRTdGF0ZTogc3RvcmUuZ2V0U3RhdGUsXG4gICAgICAgIGRpc3BhdGNoOiBmdW5jdGlvbiBkaXNwYXRjaChhY3Rpb24pIHtcbiAgICAgICAgICByZXR1cm4gX2Rpc3BhdGNoKGFjdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBjaGFpbiA9IG1pZGRsZXdhcmVzLm1hcChmdW5jdGlvbiAobWlkZGxld2FyZSkge1xuICAgICAgICByZXR1cm4gbWlkZGxld2FyZShtaWRkbGV3YXJlQVBJKTtcbiAgICAgIH0pO1xuICAgICAgX2Rpc3BhdGNoID0gX2NvbXBvc2UyWydkZWZhdWx0J10uYXBwbHkodW5kZWZpbmVkLCBjaGFpbikoc3RvcmUuZGlzcGF0Y2gpO1xuXG4gICAgICByZXR1cm4gX2V4dGVuZHMoe30sIHN0b3JlLCB7XG4gICAgICAgIGRpc3BhdGNoOiBfZGlzcGF0Y2hcbiAgICAgIH0pO1xuICAgIH07XG4gIH07XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0c1snZGVmYXVsdCddID0gYmluZEFjdGlvbkNyZWF0b3JzO1xuZnVuY3Rpb24gYmluZEFjdGlvbkNyZWF0b3IoYWN0aW9uQ3JlYXRvciwgZGlzcGF0Y2gpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gZGlzcGF0Y2goYWN0aW9uQ3JlYXRvci5hcHBseSh1bmRlZmluZWQsIGFyZ3VtZW50cykpO1xuICB9O1xufVxuXG4vKipcbiAqIFR1cm5zIGFuIG9iamVjdCB3aG9zZSB2YWx1ZXMgYXJlIGFjdGlvbiBjcmVhdG9ycywgaW50byBhbiBvYmplY3Qgd2l0aCB0aGVcbiAqIHNhbWUga2V5cywgYnV0IHdpdGggZXZlcnkgZnVuY3Rpb24gd3JhcHBlZCBpbnRvIGEgYGRpc3BhdGNoYCBjYWxsIHNvIHRoZXlcbiAqIG1heSBiZSBpbnZva2VkIGRpcmVjdGx5LiBUaGlzIGlzIGp1c3QgYSBjb252ZW5pZW5jZSBtZXRob2QsIGFzIHlvdSBjYW4gY2FsbFxuICogYHN0b3JlLmRpc3BhdGNoKE15QWN0aW9uQ3JlYXRvcnMuZG9Tb21ldGhpbmcoKSlgIHlvdXJzZWxmIGp1c3QgZmluZS5cbiAqXG4gKiBGb3IgY29udmVuaWVuY2UsIHlvdSBjYW4gYWxzbyBwYXNzIGEgc2luZ2xlIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCxcbiAqIGFuZCBnZXQgYSBmdW5jdGlvbiBpbiByZXR1cm4uXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R9IGFjdGlvbkNyZWF0b3JzIEFuIG9iamVjdCB3aG9zZSB2YWx1ZXMgYXJlIGFjdGlvblxuICogY3JlYXRvciBmdW5jdGlvbnMuIE9uZSBoYW5keSB3YXkgdG8gb2J0YWluIGl0IGlzIHRvIHVzZSBFUzYgYGltcG9ydCAqIGFzYFxuICogc3ludGF4LiBZb3UgbWF5IGFsc28gcGFzcyBhIHNpbmdsZSBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBkaXNwYXRjaCBUaGUgYGRpc3BhdGNoYCBmdW5jdGlvbiBhdmFpbGFibGUgb24geW91ciBSZWR1eFxuICogc3RvcmUuXG4gKlxuICogQHJldHVybnMge0Z1bmN0aW9ufE9iamVjdH0gVGhlIG9iamVjdCBtaW1pY2tpbmcgdGhlIG9yaWdpbmFsIG9iamVjdCwgYnV0IHdpdGhcbiAqIGV2ZXJ5IGFjdGlvbiBjcmVhdG9yIHdyYXBwZWQgaW50byB0aGUgYGRpc3BhdGNoYCBjYWxsLiBJZiB5b3UgcGFzc2VkIGFcbiAqIGZ1bmN0aW9uIGFzIGBhY3Rpb25DcmVhdG9yc2AsIHRoZSByZXR1cm4gdmFsdWUgd2lsbCBhbHNvIGJlIGEgc2luZ2xlXG4gKiBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gYmluZEFjdGlvbkNyZWF0b3JzKGFjdGlvbkNyZWF0b3JzLCBkaXNwYXRjaCkge1xuICBpZiAodHlwZW9mIGFjdGlvbkNyZWF0b3JzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGJpbmRBY3Rpb25DcmVhdG9yKGFjdGlvbkNyZWF0b3JzLCBkaXNwYXRjaCk7XG4gIH1cblxuICBpZiAodHlwZW9mIGFjdGlvbkNyZWF0b3JzICE9PSAnb2JqZWN0JyB8fCBhY3Rpb25DcmVhdG9ycyA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYmluZEFjdGlvbkNyZWF0b3JzIGV4cGVjdGVkIGFuIG9iamVjdCBvciBhIGZ1bmN0aW9uLCBpbnN0ZWFkIHJlY2VpdmVkICcgKyAoYWN0aW9uQ3JlYXRvcnMgPT09IG51bGwgPyAnbnVsbCcgOiB0eXBlb2YgYWN0aW9uQ3JlYXRvcnMpICsgJy4gJyArICdEaWQgeW91IHdyaXRlIFwiaW1wb3J0IEFjdGlvbkNyZWF0b3JzIGZyb21cIiBpbnN0ZWFkIG9mIFwiaW1wb3J0ICogYXMgQWN0aW9uQ3JlYXRvcnMgZnJvbVwiPycpO1xuICB9XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhhY3Rpb25DcmVhdG9ycyk7XG4gIHZhciBib3VuZEFjdGlvbkNyZWF0b3JzID0ge307XG4gIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgIHZhciBhY3Rpb25DcmVhdG9yID0gYWN0aW9uQ3JlYXRvcnNba2V5XTtcbiAgICBpZiAodHlwZW9mIGFjdGlvbkNyZWF0b3IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGJvdW5kQWN0aW9uQ3JlYXRvcnNba2V5XSA9IGJpbmRBY3Rpb25DcmVhdG9yKGFjdGlvbkNyZWF0b3IsIGRpc3BhdGNoKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJvdW5kQWN0aW9uQ3JlYXRvcnM7XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0c1snZGVmYXVsdCddID0gY29tYmluZVJlZHVjZXJzO1xuXG52YXIgX2NyZWF0ZVN0b3JlID0gcmVxdWlyZSgnLi9jcmVhdGVTdG9yZScpO1xuXG52YXIgX2lzUGxhaW5PYmplY3QgPSByZXF1aXJlKCdsb2Rhc2gvaXNQbGFpbk9iamVjdCcpO1xuXG52YXIgX2lzUGxhaW5PYmplY3QyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaXNQbGFpbk9iamVjdCk7XG5cbnZhciBfd2FybmluZyA9IHJlcXVpcmUoJy4vdXRpbHMvd2FybmluZycpO1xuXG52YXIgX3dhcm5pbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfd2FybmluZyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxuZnVuY3Rpb24gZ2V0VW5kZWZpbmVkU3RhdGVFcnJvck1lc3NhZ2Uoa2V5LCBhY3Rpb24pIHtcbiAgdmFyIGFjdGlvblR5cGUgPSBhY3Rpb24gJiYgYWN0aW9uLnR5cGU7XG4gIHZhciBhY3Rpb25OYW1lID0gYWN0aW9uVHlwZSAmJiAnXCInICsgYWN0aW9uVHlwZS50b1N0cmluZygpICsgJ1wiJyB8fCAnYW4gYWN0aW9uJztcblxuICByZXR1cm4gJ0dpdmVuIGFjdGlvbiAnICsgYWN0aW9uTmFtZSArICcsIHJlZHVjZXIgXCInICsga2V5ICsgJ1wiIHJldHVybmVkIHVuZGVmaW5lZC4gJyArICdUbyBpZ25vcmUgYW4gYWN0aW9uLCB5b3UgbXVzdCBleHBsaWNpdGx5IHJldHVybiB0aGUgcHJldmlvdXMgc3RhdGUuJztcbn1cblxuZnVuY3Rpb24gZ2V0VW5leHBlY3RlZFN0YXRlU2hhcGVXYXJuaW5nTWVzc2FnZShpbnB1dFN0YXRlLCByZWR1Y2VycywgYWN0aW9uLCB1bmV4cGVjdGVkS2V5Q2FjaGUpIHtcbiAgdmFyIHJlZHVjZXJLZXlzID0gT2JqZWN0LmtleXMocmVkdWNlcnMpO1xuICB2YXIgYXJndW1lbnROYW1lID0gYWN0aW9uICYmIGFjdGlvbi50eXBlID09PSBfY3JlYXRlU3RvcmUuQWN0aW9uVHlwZXMuSU5JVCA/ICdwcmVsb2FkZWRTdGF0ZSBhcmd1bWVudCBwYXNzZWQgdG8gY3JlYXRlU3RvcmUnIDogJ3ByZXZpb3VzIHN0YXRlIHJlY2VpdmVkIGJ5IHRoZSByZWR1Y2VyJztcblxuICBpZiAocmVkdWNlcktleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuICdTdG9yZSBkb2VzIG5vdCBoYXZlIGEgdmFsaWQgcmVkdWNlci4gTWFrZSBzdXJlIHRoZSBhcmd1bWVudCBwYXNzZWQgJyArICd0byBjb21iaW5lUmVkdWNlcnMgaXMgYW4gb2JqZWN0IHdob3NlIHZhbHVlcyBhcmUgcmVkdWNlcnMuJztcbiAgfVxuXG4gIGlmICghKDAsIF9pc1BsYWluT2JqZWN0MlsnZGVmYXVsdCddKShpbnB1dFN0YXRlKSkge1xuICAgIHJldHVybiAnVGhlICcgKyBhcmd1bWVudE5hbWUgKyAnIGhhcyB1bmV4cGVjdGVkIHR5cGUgb2YgXCInICsge30udG9TdHJpbmcuY2FsbChpbnB1dFN0YXRlKS5tYXRjaCgvXFxzKFthLXp8QS1aXSspLylbMV0gKyAnXCIuIEV4cGVjdGVkIGFyZ3VtZW50IHRvIGJlIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgJyArICgna2V5czogXCInICsgcmVkdWNlcktleXMuam9pbignXCIsIFwiJykgKyAnXCInKTtcbiAgfVxuXG4gIHZhciB1bmV4cGVjdGVkS2V5cyA9IE9iamVjdC5rZXlzKGlucHV0U3RhdGUpLmZpbHRlcihmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuICFyZWR1Y2Vycy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICF1bmV4cGVjdGVkS2V5Q2FjaGVba2V5XTtcbiAgfSk7XG5cbiAgdW5leHBlY3RlZEtleXMuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgdW5leHBlY3RlZEtleUNhY2hlW2tleV0gPSB0cnVlO1xuICB9KTtcblxuICBpZiAodW5leHBlY3RlZEtleXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiAnVW5leHBlY3RlZCAnICsgKHVuZXhwZWN0ZWRLZXlzLmxlbmd0aCA+IDEgPyAna2V5cycgOiAna2V5JykgKyAnICcgKyAoJ1wiJyArIHVuZXhwZWN0ZWRLZXlzLmpvaW4oJ1wiLCBcIicpICsgJ1wiIGZvdW5kIGluICcgKyBhcmd1bWVudE5hbWUgKyAnLiAnKSArICdFeHBlY3RlZCB0byBmaW5kIG9uZSBvZiB0aGUga25vd24gcmVkdWNlciBrZXlzIGluc3RlYWQ6ICcgKyAoJ1wiJyArIHJlZHVjZXJLZXlzLmpvaW4oJ1wiLCBcIicpICsgJ1wiLiBVbmV4cGVjdGVkIGtleXMgd2lsbCBiZSBpZ25vcmVkLicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydFJlZHVjZXJTYW5pdHkocmVkdWNlcnMpIHtcbiAgT2JqZWN0LmtleXMocmVkdWNlcnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHZhciByZWR1Y2VyID0gcmVkdWNlcnNba2V5XTtcbiAgICB2YXIgaW5pdGlhbFN0YXRlID0gcmVkdWNlcih1bmRlZmluZWQsIHsgdHlwZTogX2NyZWF0ZVN0b3JlLkFjdGlvblR5cGVzLklOSVQgfSk7XG5cbiAgICBpZiAodHlwZW9mIGluaXRpYWxTdGF0ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUmVkdWNlciBcIicgKyBrZXkgKyAnXCIgcmV0dXJuZWQgdW5kZWZpbmVkIGR1cmluZyBpbml0aWFsaXphdGlvbi4gJyArICdJZiB0aGUgc3RhdGUgcGFzc2VkIHRvIHRoZSByZWR1Y2VyIGlzIHVuZGVmaW5lZCwgeW91IG11c3QgJyArICdleHBsaWNpdGx5IHJldHVybiB0aGUgaW5pdGlhbCBzdGF0ZS4gVGhlIGluaXRpYWwgc3RhdGUgbWF5ICcgKyAnbm90IGJlIHVuZGVmaW5lZC4nKTtcbiAgICB9XG5cbiAgICB2YXIgdHlwZSA9ICdAQHJlZHV4L1BST0JFX1VOS05PV05fQUNUSU9OXycgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoNykuc3BsaXQoJycpLmpvaW4oJy4nKTtcbiAgICBpZiAodHlwZW9mIHJlZHVjZXIodW5kZWZpbmVkLCB7IHR5cGU6IHR5cGUgfSkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlZHVjZXIgXCInICsga2V5ICsgJ1wiIHJldHVybmVkIHVuZGVmaW5lZCB3aGVuIHByb2JlZCB3aXRoIGEgcmFuZG9tIHR5cGUuICcgKyAoJ0RvblxcJ3QgdHJ5IHRvIGhhbmRsZSAnICsgX2NyZWF0ZVN0b3JlLkFjdGlvblR5cGVzLklOSVQgKyAnIG9yIG90aGVyIGFjdGlvbnMgaW4gXCJyZWR1eC8qXCIgJykgKyAnbmFtZXNwYWNlLiBUaGV5IGFyZSBjb25zaWRlcmVkIHByaXZhdGUuIEluc3RlYWQsIHlvdSBtdXN0IHJldHVybiB0aGUgJyArICdjdXJyZW50IHN0YXRlIGZvciBhbnkgdW5rbm93biBhY3Rpb25zLCB1bmxlc3MgaXQgaXMgdW5kZWZpbmVkLCAnICsgJ2luIHdoaWNoIGNhc2UgeW91IG11c3QgcmV0dXJuIHRoZSBpbml0aWFsIHN0YXRlLCByZWdhcmRsZXNzIG9mIHRoZSAnICsgJ2FjdGlvbiB0eXBlLiBUaGUgaW5pdGlhbCBzdGF0ZSBtYXkgbm90IGJlIHVuZGVmaW5lZC4nKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vKipcbiAqIFR1cm5zIGFuIG9iamVjdCB3aG9zZSB2YWx1ZXMgYXJlIGRpZmZlcmVudCByZWR1Y2VyIGZ1bmN0aW9ucywgaW50byBhIHNpbmdsZVxuICogcmVkdWNlciBmdW5jdGlvbi4gSXQgd2lsbCBjYWxsIGV2ZXJ5IGNoaWxkIHJlZHVjZXIsIGFuZCBnYXRoZXIgdGhlaXIgcmVzdWx0c1xuICogaW50byBhIHNpbmdsZSBzdGF0ZSBvYmplY3QsIHdob3NlIGtleXMgY29ycmVzcG9uZCB0byB0aGUga2V5cyBvZiB0aGUgcGFzc2VkXG4gKiByZWR1Y2VyIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gcmVkdWNlcnMgQW4gb2JqZWN0IHdob3NlIHZhbHVlcyBjb3JyZXNwb25kIHRvIGRpZmZlcmVudFxuICogcmVkdWNlciBmdW5jdGlvbnMgdGhhdCBuZWVkIHRvIGJlIGNvbWJpbmVkIGludG8gb25lLiBPbmUgaGFuZHkgd2F5IHRvIG9idGFpblxuICogaXQgaXMgdG8gdXNlIEVTNiBgaW1wb3J0ICogYXMgcmVkdWNlcnNgIHN5bnRheC4gVGhlIHJlZHVjZXJzIG1heSBuZXZlciByZXR1cm5cbiAqIHVuZGVmaW5lZCBmb3IgYW55IGFjdGlvbi4gSW5zdGVhZCwgdGhleSBzaG91bGQgcmV0dXJuIHRoZWlyIGluaXRpYWwgc3RhdGVcbiAqIGlmIHRoZSBzdGF0ZSBwYXNzZWQgdG8gdGhlbSB3YXMgdW5kZWZpbmVkLCBhbmQgdGhlIGN1cnJlbnQgc3RhdGUgZm9yIGFueVxuICogdW5yZWNvZ25pemVkIGFjdGlvbi5cbiAqXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IEEgcmVkdWNlciBmdW5jdGlvbiB0aGF0IGludm9rZXMgZXZlcnkgcmVkdWNlciBpbnNpZGUgdGhlXG4gKiBwYXNzZWQgb2JqZWN0LCBhbmQgYnVpbGRzIGEgc3RhdGUgb2JqZWN0IHdpdGggdGhlIHNhbWUgc2hhcGUuXG4gKi9cbmZ1bmN0aW9uIGNvbWJpbmVSZWR1Y2VycyhyZWR1Y2Vycykge1xuICB2YXIgcmVkdWNlcktleXMgPSBPYmplY3Qua2V5cyhyZWR1Y2Vycyk7XG4gIHZhciBmaW5hbFJlZHVjZXJzID0ge307XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmVkdWNlcktleXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIga2V5ID0gcmVkdWNlcktleXNbaV07XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgaWYgKHR5cGVvZiByZWR1Y2Vyc1trZXldID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAoMCwgX3dhcm5pbmcyWydkZWZhdWx0J10pKCdObyByZWR1Y2VyIHByb3ZpZGVkIGZvciBrZXkgXCInICsga2V5ICsgJ1wiJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiByZWR1Y2Vyc1trZXldID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBmaW5hbFJlZHVjZXJzW2tleV0gPSByZWR1Y2Vyc1trZXldO1xuICAgIH1cbiAgfVxuICB2YXIgZmluYWxSZWR1Y2VyS2V5cyA9IE9iamVjdC5rZXlzKGZpbmFsUmVkdWNlcnMpO1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgdmFyIHVuZXhwZWN0ZWRLZXlDYWNoZSA9IHt9O1xuICB9XG5cbiAgdmFyIHNhbml0eUVycm9yO1xuICB0cnkge1xuICAgIGFzc2VydFJlZHVjZXJTYW5pdHkoZmluYWxSZWR1Y2Vycyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBzYW5pdHlFcnJvciA9IGU7XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24gY29tYmluYXRpb24oKSB7XG4gICAgdmFyIHN0YXRlID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbMF07XG4gICAgdmFyIGFjdGlvbiA9IGFyZ3VtZW50c1sxXTtcblxuICAgIGlmIChzYW5pdHlFcnJvcikge1xuICAgICAgdGhyb3cgc2FuaXR5RXJyb3I7XG4gICAgfVxuXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIHZhciB3YXJuaW5nTWVzc2FnZSA9IGdldFVuZXhwZWN0ZWRTdGF0ZVNoYXBlV2FybmluZ01lc3NhZ2Uoc3RhdGUsIGZpbmFsUmVkdWNlcnMsIGFjdGlvbiwgdW5leHBlY3RlZEtleUNhY2hlKTtcbiAgICAgIGlmICh3YXJuaW5nTWVzc2FnZSkge1xuICAgICAgICAoMCwgX3dhcm5pbmcyWydkZWZhdWx0J10pKHdhcm5pbmdNZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgaGFzQ2hhbmdlZCA9IGZhbHNlO1xuICAgIHZhciBuZXh0U3RhdGUgPSB7fTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpbmFsUmVkdWNlcktleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBmaW5hbFJlZHVjZXJLZXlzW2ldO1xuICAgICAgdmFyIHJlZHVjZXIgPSBmaW5hbFJlZHVjZXJzW2tleV07XG4gICAgICB2YXIgcHJldmlvdXNTdGF0ZUZvcktleSA9IHN0YXRlW2tleV07XG4gICAgICB2YXIgbmV4dFN0YXRlRm9yS2V5ID0gcmVkdWNlcihwcmV2aW91c1N0YXRlRm9yS2V5LCBhY3Rpb24pO1xuICAgICAgaWYgKHR5cGVvZiBuZXh0U3RhdGVGb3JLZXkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBlcnJvck1lc3NhZ2UgPSBnZXRVbmRlZmluZWRTdGF0ZUVycm9yTWVzc2FnZShrZXksIGFjdGlvbik7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgfVxuICAgICAgbmV4dFN0YXRlW2tleV0gPSBuZXh0U3RhdGVGb3JLZXk7XG4gICAgICBoYXNDaGFuZ2VkID0gaGFzQ2hhbmdlZCB8fCBuZXh0U3RhdGVGb3JLZXkgIT09IHByZXZpb3VzU3RhdGVGb3JLZXk7XG4gICAgfVxuICAgIHJldHVybiBoYXNDaGFuZ2VkID8gbmV4dFN0YXRlIDogc3RhdGU7XG4gIH07XG59IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IGNvbXBvc2U7XG4vKipcbiAqIENvbXBvc2VzIHNpbmdsZS1hcmd1bWVudCBmdW5jdGlvbnMgZnJvbSByaWdodCB0byBsZWZ0LiBUaGUgcmlnaHRtb3N0XG4gKiBmdW5jdGlvbiBjYW4gdGFrZSBtdWx0aXBsZSBhcmd1bWVudHMgYXMgaXQgcHJvdmlkZXMgdGhlIHNpZ25hdHVyZSBmb3JcbiAqIHRoZSByZXN1bHRpbmcgY29tcG9zaXRlIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7Li4uRnVuY3Rpb259IGZ1bmNzIFRoZSBmdW5jdGlvbnMgdG8gY29tcG9zZS5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gQSBmdW5jdGlvbiBvYnRhaW5lZCBieSBjb21wb3NpbmcgdGhlIGFyZ3VtZW50IGZ1bmN0aW9uc1xuICogZnJvbSByaWdodCB0byBsZWZ0LiBGb3IgZXhhbXBsZSwgY29tcG9zZShmLCBnLCBoKSBpcyBpZGVudGljYWwgdG8gZG9pbmdcbiAqICguLi5hcmdzKSA9PiBmKGcoaCguLi5hcmdzKSkpLlxuICovXG5cbmZ1bmN0aW9uIGNvbXBvc2UoKSB7XG4gIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBmdW5jcyA9IEFycmF5KF9sZW4pLCBfa2V5ID0gMDsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgIGZ1bmNzW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICB9XG5cbiAgaWYgKGZ1bmNzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoYXJnKSB7XG4gICAgICByZXR1cm4gYXJnO1xuICAgIH07XG4gIH1cblxuICBpZiAoZnVuY3MubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGZ1bmNzWzBdO1xuICB9XG5cbiAgdmFyIGxhc3QgPSBmdW5jc1tmdW5jcy5sZW5ndGggLSAxXTtcbiAgdmFyIHJlc3QgPSBmdW5jcy5zbGljZSgwLCAtMSk7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHJlc3QucmVkdWNlUmlnaHQoZnVuY3Rpb24gKGNvbXBvc2VkLCBmKSB7XG4gICAgICByZXR1cm4gZihjb21wb3NlZCk7XG4gICAgfSwgbGFzdC5hcHBseSh1bmRlZmluZWQsIGFyZ3VtZW50cykpO1xuICB9O1xufSIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMuQWN0aW9uVHlwZXMgPSB1bmRlZmluZWQ7XG5leHBvcnRzWydkZWZhdWx0J10gPSBjcmVhdGVTdG9yZTtcblxudmFyIF9pc1BsYWluT2JqZWN0ID0gcmVxdWlyZSgnbG9kYXNoL2lzUGxhaW5PYmplY3QnKTtcblxudmFyIF9pc1BsYWluT2JqZWN0MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2lzUGxhaW5PYmplY3QpO1xuXG52YXIgX3N5bWJvbE9ic2VydmFibGUgPSByZXF1aXJlKCdzeW1ib2wtb2JzZXJ2YWJsZScpO1xuXG52YXIgX3N5bWJvbE9ic2VydmFibGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfc3ltYm9sT2JzZXJ2YWJsZSk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxuLyoqXG4gKiBUaGVzZSBhcmUgcHJpdmF0ZSBhY3Rpb24gdHlwZXMgcmVzZXJ2ZWQgYnkgUmVkdXguXG4gKiBGb3IgYW55IHVua25vd24gYWN0aW9ucywgeW91IG11c3QgcmV0dXJuIHRoZSBjdXJyZW50IHN0YXRlLlxuICogSWYgdGhlIGN1cnJlbnQgc3RhdGUgaXMgdW5kZWZpbmVkLCB5b3UgbXVzdCByZXR1cm4gdGhlIGluaXRpYWwgc3RhdGUuXG4gKiBEbyBub3QgcmVmZXJlbmNlIHRoZXNlIGFjdGlvbiB0eXBlcyBkaXJlY3RseSBpbiB5b3VyIGNvZGUuXG4gKi9cbnZhciBBY3Rpb25UeXBlcyA9IGV4cG9ydHMuQWN0aW9uVHlwZXMgPSB7XG4gIElOSVQ6ICdAQHJlZHV4L0lOSVQnXG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBSZWR1eCBzdG9yZSB0aGF0IGhvbGRzIHRoZSBzdGF0ZSB0cmVlLlxuICogVGhlIG9ubHkgd2F5IHRvIGNoYW5nZSB0aGUgZGF0YSBpbiB0aGUgc3RvcmUgaXMgdG8gY2FsbCBgZGlzcGF0Y2goKWAgb24gaXQuXG4gKlxuICogVGhlcmUgc2hvdWxkIG9ubHkgYmUgYSBzaW5nbGUgc3RvcmUgaW4geW91ciBhcHAuIFRvIHNwZWNpZnkgaG93IGRpZmZlcmVudFxuICogcGFydHMgb2YgdGhlIHN0YXRlIHRyZWUgcmVzcG9uZCB0byBhY3Rpb25zLCB5b3UgbWF5IGNvbWJpbmUgc2V2ZXJhbCByZWR1Y2Vyc1xuICogaW50byBhIHNpbmdsZSByZWR1Y2VyIGZ1bmN0aW9uIGJ5IHVzaW5nIGBjb21iaW5lUmVkdWNlcnNgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlZHVjZXIgQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIG5leHQgc3RhdGUgdHJlZSwgZ2l2ZW5cbiAqIHRoZSBjdXJyZW50IHN0YXRlIHRyZWUgYW5kIHRoZSBhY3Rpb24gdG8gaGFuZGxlLlxuICpcbiAqIEBwYXJhbSB7YW55fSBbcHJlbG9hZGVkU3RhdGVdIFRoZSBpbml0aWFsIHN0YXRlLiBZb3UgbWF5IG9wdGlvbmFsbHkgc3BlY2lmeSBpdFxuICogdG8gaHlkcmF0ZSB0aGUgc3RhdGUgZnJvbSB0aGUgc2VydmVyIGluIHVuaXZlcnNhbCBhcHBzLCBvciB0byByZXN0b3JlIGFcbiAqIHByZXZpb3VzbHkgc2VyaWFsaXplZCB1c2VyIHNlc3Npb24uXG4gKiBJZiB5b3UgdXNlIGBjb21iaW5lUmVkdWNlcnNgIHRvIHByb2R1Y2UgdGhlIHJvb3QgcmVkdWNlciBmdW5jdGlvbiwgdGhpcyBtdXN0IGJlXG4gKiBhbiBvYmplY3Qgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBgY29tYmluZVJlZHVjZXJzYCBrZXlzLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGVuaGFuY2VyIFRoZSBzdG9yZSBlbmhhbmNlci4gWW91IG1heSBvcHRpb25hbGx5IHNwZWNpZnkgaXRcbiAqIHRvIGVuaGFuY2UgdGhlIHN0b3JlIHdpdGggdGhpcmQtcGFydHkgY2FwYWJpbGl0aWVzIHN1Y2ggYXMgbWlkZGxld2FyZSxcbiAqIHRpbWUgdHJhdmVsLCBwZXJzaXN0ZW5jZSwgZXRjLiBUaGUgb25seSBzdG9yZSBlbmhhbmNlciB0aGF0IHNoaXBzIHdpdGggUmVkdXhcbiAqIGlzIGBhcHBseU1pZGRsZXdhcmUoKWAuXG4gKlxuICogQHJldHVybnMge1N0b3JlfSBBIFJlZHV4IHN0b3JlIHRoYXQgbGV0cyB5b3UgcmVhZCB0aGUgc3RhdGUsIGRpc3BhdGNoIGFjdGlvbnNcbiAqIGFuZCBzdWJzY3JpYmUgdG8gY2hhbmdlcy5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlU3RvcmUocmVkdWNlciwgcHJlbG9hZGVkU3RhdGUsIGVuaGFuY2VyKSB7XG4gIHZhciBfcmVmMjtcblxuICBpZiAodHlwZW9mIHByZWxvYWRlZFN0YXRlID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBlbmhhbmNlciA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBlbmhhbmNlciA9IHByZWxvYWRlZFN0YXRlO1xuICAgIHByZWxvYWRlZFN0YXRlID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBlbmhhbmNlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAodHlwZW9mIGVuaGFuY2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRoZSBlbmhhbmNlciB0byBiZSBhIGZ1bmN0aW9uLicpO1xuICAgIH1cblxuICAgIHJldHVybiBlbmhhbmNlcihjcmVhdGVTdG9yZSkocmVkdWNlciwgcHJlbG9hZGVkU3RhdGUpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiByZWR1Y2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCB0aGUgcmVkdWNlciB0byBiZSBhIGZ1bmN0aW9uLicpO1xuICB9XG5cbiAgdmFyIGN1cnJlbnRSZWR1Y2VyID0gcmVkdWNlcjtcbiAgdmFyIGN1cnJlbnRTdGF0ZSA9IHByZWxvYWRlZFN0YXRlO1xuICB2YXIgY3VycmVudExpc3RlbmVycyA9IFtdO1xuICB2YXIgbmV4dExpc3RlbmVycyA9IGN1cnJlbnRMaXN0ZW5lcnM7XG4gIHZhciBpc0Rpc3BhdGNoaW5nID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZW5zdXJlQ2FuTXV0YXRlTmV4dExpc3RlbmVycygpIHtcbiAgICBpZiAobmV4dExpc3RlbmVycyA9PT0gY3VycmVudExpc3RlbmVycykge1xuICAgICAgbmV4dExpc3RlbmVycyA9IGN1cnJlbnRMaXN0ZW5lcnMuc2xpY2UoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVhZHMgdGhlIHN0YXRlIHRyZWUgbWFuYWdlZCBieSB0aGUgc3RvcmUuXG4gICAqXG4gICAqIEByZXR1cm5zIHthbnl9IFRoZSBjdXJyZW50IHN0YXRlIHRyZWUgb2YgeW91ciBhcHBsaWNhdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIGdldFN0YXRlKCkge1xuICAgIHJldHVybiBjdXJyZW50U3RhdGU7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIGNoYW5nZSBsaXN0ZW5lci4gSXQgd2lsbCBiZSBjYWxsZWQgYW55IHRpbWUgYW4gYWN0aW9uIGlzIGRpc3BhdGNoZWQsXG4gICAqIGFuZCBzb21lIHBhcnQgb2YgdGhlIHN0YXRlIHRyZWUgbWF5IHBvdGVudGlhbGx5IGhhdmUgY2hhbmdlZC4gWW91IG1heSB0aGVuXG4gICAqIGNhbGwgYGdldFN0YXRlKClgIHRvIHJlYWQgdGhlIGN1cnJlbnQgc3RhdGUgdHJlZSBpbnNpZGUgdGhlIGNhbGxiYWNrLlxuICAgKlxuICAgKiBZb3UgbWF5IGNhbGwgYGRpc3BhdGNoKClgIGZyb20gYSBjaGFuZ2UgbGlzdGVuZXIsIHdpdGggdGhlIGZvbGxvd2luZ1xuICAgKiBjYXZlYXRzOlxuICAgKlxuICAgKiAxLiBUaGUgc3Vic2NyaXB0aW9ucyBhcmUgc25hcHNob3R0ZWQganVzdCBiZWZvcmUgZXZlcnkgYGRpc3BhdGNoKClgIGNhbGwuXG4gICAqIElmIHlvdSBzdWJzY3JpYmUgb3IgdW5zdWJzY3JpYmUgd2hpbGUgdGhlIGxpc3RlbmVycyBhcmUgYmVpbmcgaW52b2tlZCwgdGhpc1xuICAgKiB3aWxsIG5vdCBoYXZlIGFueSBlZmZlY3Qgb24gdGhlIGBkaXNwYXRjaCgpYCB0aGF0IGlzIGN1cnJlbnRseSBpbiBwcm9ncmVzcy5cbiAgICogSG93ZXZlciwgdGhlIG5leHQgYGRpc3BhdGNoKClgIGNhbGwsIHdoZXRoZXIgbmVzdGVkIG9yIG5vdCwgd2lsbCB1c2UgYSBtb3JlXG4gICAqIHJlY2VudCBzbmFwc2hvdCBvZiB0aGUgc3Vic2NyaXB0aW9uIGxpc3QuXG4gICAqXG4gICAqIDIuIFRoZSBsaXN0ZW5lciBzaG91bGQgbm90IGV4cGVjdCB0byBzZWUgYWxsIHN0YXRlIGNoYW5nZXMsIGFzIHRoZSBzdGF0ZVxuICAgKiBtaWdodCBoYXZlIGJlZW4gdXBkYXRlZCBtdWx0aXBsZSB0aW1lcyBkdXJpbmcgYSBuZXN0ZWQgYGRpc3BhdGNoKClgIGJlZm9yZVxuICAgKiB0aGUgbGlzdGVuZXIgaXMgY2FsbGVkLiBJdCBpcywgaG93ZXZlciwgZ3VhcmFudGVlZCB0aGF0IGFsbCBzdWJzY3JpYmVyc1xuICAgKiByZWdpc3RlcmVkIGJlZm9yZSB0aGUgYGRpc3BhdGNoKClgIHN0YXJ0ZWQgd2lsbCBiZSBjYWxsZWQgd2l0aCB0aGUgbGF0ZXN0XG4gICAqIHN0YXRlIGJ5IHRoZSB0aW1lIGl0IGV4aXRzLlxuICAgKlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBBIGNhbGxiYWNrIHRvIGJlIGludm9rZWQgb24gZXZlcnkgZGlzcGF0Y2guXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gQSBmdW5jdGlvbiB0byByZW1vdmUgdGhpcyBjaGFuZ2UgbGlzdGVuZXIuXG4gICAqL1xuICBmdW5jdGlvbiBzdWJzY3JpYmUobGlzdGVuZXIpIHtcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGxpc3RlbmVyIHRvIGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgfVxuXG4gICAgdmFyIGlzU3Vic2NyaWJlZCA9IHRydWU7XG5cbiAgICBlbnN1cmVDYW5NdXRhdGVOZXh0TGlzdGVuZXJzKCk7XG4gICAgbmV4dExpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiB1bnN1YnNjcmliZSgpIHtcbiAgICAgIGlmICghaXNTdWJzY3JpYmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaXNTdWJzY3JpYmVkID0gZmFsc2U7XG5cbiAgICAgIGVuc3VyZUNhbk11dGF0ZU5leHRMaXN0ZW5lcnMoKTtcbiAgICAgIHZhciBpbmRleCA9IG5leHRMaXN0ZW5lcnMuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBuZXh0TGlzdGVuZXJzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwYXRjaGVzIGFuIGFjdGlvbi4gSXQgaXMgdGhlIG9ubHkgd2F5IHRvIHRyaWdnZXIgYSBzdGF0ZSBjaGFuZ2UuXG4gICAqXG4gICAqIFRoZSBgcmVkdWNlcmAgZnVuY3Rpb24sIHVzZWQgdG8gY3JlYXRlIHRoZSBzdG9yZSwgd2lsbCBiZSBjYWxsZWQgd2l0aCB0aGVcbiAgICogY3VycmVudCBzdGF0ZSB0cmVlIGFuZCB0aGUgZ2l2ZW4gYGFjdGlvbmAuIEl0cyByZXR1cm4gdmFsdWUgd2lsbFxuICAgKiBiZSBjb25zaWRlcmVkIHRoZSAqKm5leHQqKiBzdGF0ZSBvZiB0aGUgdHJlZSwgYW5kIHRoZSBjaGFuZ2UgbGlzdGVuZXJzXG4gICAqIHdpbGwgYmUgbm90aWZpZWQuXG4gICAqXG4gICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9ubHkgc3VwcG9ydHMgcGxhaW4gb2JqZWN0IGFjdGlvbnMuIElmIHlvdSB3YW50IHRvXG4gICAqIGRpc3BhdGNoIGEgUHJvbWlzZSwgYW4gT2JzZXJ2YWJsZSwgYSB0aHVuaywgb3Igc29tZXRoaW5nIGVsc2UsIHlvdSBuZWVkIHRvXG4gICAqIHdyYXAgeW91ciBzdG9yZSBjcmVhdGluZyBmdW5jdGlvbiBpbnRvIHRoZSBjb3JyZXNwb25kaW5nIG1pZGRsZXdhcmUuIEZvclxuICAgKiBleGFtcGxlLCBzZWUgdGhlIGRvY3VtZW50YXRpb24gZm9yIHRoZSBgcmVkdXgtdGh1bmtgIHBhY2thZ2UuIEV2ZW4gdGhlXG4gICAqIG1pZGRsZXdhcmUgd2lsbCBldmVudHVhbGx5IGRpc3BhdGNoIHBsYWluIG9iamVjdCBhY3Rpb25zIHVzaW5nIHRoaXMgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gYWN0aW9uIEEgcGxhaW4gb2JqZWN0IHJlcHJlc2VudGluZyDigJx3aGF0IGNoYW5nZWTigJ0uIEl0IGlzXG4gICAqIGEgZ29vZCBpZGVhIHRvIGtlZXAgYWN0aW9ucyBzZXJpYWxpemFibGUgc28geW91IGNhbiByZWNvcmQgYW5kIHJlcGxheSB1c2VyXG4gICAqIHNlc3Npb25zLCBvciB1c2UgdGhlIHRpbWUgdHJhdmVsbGluZyBgcmVkdXgtZGV2dG9vbHNgLiBBbiBhY3Rpb24gbXVzdCBoYXZlXG4gICAqIGEgYHR5cGVgIHByb3BlcnR5IHdoaWNoIG1heSBub3QgYmUgYHVuZGVmaW5lZGAuIEl0IGlzIGEgZ29vZCBpZGVhIHRvIHVzZVxuICAgKiBzdHJpbmcgY29uc3RhbnRzIGZvciBhY3Rpb24gdHlwZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IEZvciBjb252ZW5pZW5jZSwgdGhlIHNhbWUgYWN0aW9uIG9iamVjdCB5b3UgZGlzcGF0Y2hlZC5cbiAgICpcbiAgICogTm90ZSB0aGF0LCBpZiB5b3UgdXNlIGEgY3VzdG9tIG1pZGRsZXdhcmUsIGl0IG1heSB3cmFwIGBkaXNwYXRjaCgpYCB0b1xuICAgKiByZXR1cm4gc29tZXRoaW5nIGVsc2UgKGZvciBleGFtcGxlLCBhIFByb21pc2UgeW91IGNhbiBhd2FpdCkuXG4gICAqL1xuICBmdW5jdGlvbiBkaXNwYXRjaChhY3Rpb24pIHtcbiAgICBpZiAoISgwLCBfaXNQbGFpbk9iamVjdDJbJ2RlZmF1bHQnXSkoYWN0aW9uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBY3Rpb25zIG11c3QgYmUgcGxhaW4gb2JqZWN0cy4gJyArICdVc2UgY3VzdG9tIG1pZGRsZXdhcmUgZm9yIGFzeW5jIGFjdGlvbnMuJyk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhY3Rpb24udHlwZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQWN0aW9ucyBtYXkgbm90IGhhdmUgYW4gdW5kZWZpbmVkIFwidHlwZVwiIHByb3BlcnR5LiAnICsgJ0hhdmUgeW91IG1pc3NwZWxsZWQgYSBjb25zdGFudD8nKTtcbiAgICB9XG5cbiAgICBpZiAoaXNEaXNwYXRjaGluZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZWR1Y2VycyBtYXkgbm90IGRpc3BhdGNoIGFjdGlvbnMuJyk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGlzRGlzcGF0Y2hpbmcgPSB0cnVlO1xuICAgICAgY3VycmVudFN0YXRlID0gY3VycmVudFJlZHVjZXIoY3VycmVudFN0YXRlLCBhY3Rpb24pO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBpc0Rpc3BhdGNoaW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGxpc3RlbmVycyA9IGN1cnJlbnRMaXN0ZW5lcnMgPSBuZXh0TGlzdGVuZXJzO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsaXN0ZW5lcnNbaV0oKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIHRoZSByZWR1Y2VyIGN1cnJlbnRseSB1c2VkIGJ5IHRoZSBzdG9yZSB0byBjYWxjdWxhdGUgdGhlIHN0YXRlLlxuICAgKlxuICAgKiBZb3UgbWlnaHQgbmVlZCB0aGlzIGlmIHlvdXIgYXBwIGltcGxlbWVudHMgY29kZSBzcGxpdHRpbmcgYW5kIHlvdSB3YW50IHRvXG4gICAqIGxvYWQgc29tZSBvZiB0aGUgcmVkdWNlcnMgZHluYW1pY2FsbHkuIFlvdSBtaWdodCBhbHNvIG5lZWQgdGhpcyBpZiB5b3VcbiAgICogaW1wbGVtZW50IGEgaG90IHJlbG9hZGluZyBtZWNoYW5pc20gZm9yIFJlZHV4LlxuICAgKlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBuZXh0UmVkdWNlciBUaGUgcmVkdWNlciBmb3IgdGhlIHN0b3JlIHRvIHVzZSBpbnN0ZWFkLlxuICAgKiBAcmV0dXJucyB7dm9pZH1cbiAgICovXG4gIGZ1bmN0aW9uIHJlcGxhY2VSZWR1Y2VyKG5leHRSZWR1Y2VyKSB7XG4gICAgaWYgKHR5cGVvZiBuZXh0UmVkdWNlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCB0aGUgbmV4dFJlZHVjZXIgdG8gYmUgYSBmdW5jdGlvbi4nKTtcbiAgICB9XG5cbiAgICBjdXJyZW50UmVkdWNlciA9IG5leHRSZWR1Y2VyO1xuICAgIGRpc3BhdGNoKHsgdHlwZTogQWN0aW9uVHlwZXMuSU5JVCB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm9wZXJhYmlsaXR5IHBvaW50IGZvciBvYnNlcnZhYmxlL3JlYWN0aXZlIGxpYnJhcmllcy5cbiAgICogQHJldHVybnMge29ic2VydmFibGV9IEEgbWluaW1hbCBvYnNlcnZhYmxlIG9mIHN0YXRlIGNoYW5nZXMuXG4gICAqIEZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgdGhlIG9ic2VydmFibGUgcHJvcG9zYWw6XG4gICAqIGh0dHBzOi8vZ2l0aHViLmNvbS96ZW5wYXJzaW5nL2VzLW9ic2VydmFibGVcbiAgICovXG4gIGZ1bmN0aW9uIG9ic2VydmFibGUoKSB7XG4gICAgdmFyIF9yZWY7XG5cbiAgICB2YXIgb3V0ZXJTdWJzY3JpYmUgPSBzdWJzY3JpYmU7XG4gICAgcmV0dXJuIF9yZWYgPSB7XG4gICAgICAvKipcbiAgICAgICAqIFRoZSBtaW5pbWFsIG9ic2VydmFibGUgc3Vic2NyaXB0aW9uIG1ldGhvZC5cbiAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYnNlcnZlciBBbnkgb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgYXMgYW4gb2JzZXJ2ZXIuXG4gICAgICAgKiBUaGUgb2JzZXJ2ZXIgb2JqZWN0IHNob3VsZCBoYXZlIGEgYG5leHRgIG1ldGhvZC5cbiAgICAgICAqIEByZXR1cm5zIHtzdWJzY3JpcHRpb259IEFuIG9iamVjdCB3aXRoIGFuIGB1bnN1YnNjcmliZWAgbWV0aG9kIHRoYXQgY2FuXG4gICAgICAgKiBiZSB1c2VkIHRvIHVuc3Vic2NyaWJlIHRoZSBvYnNlcnZhYmxlIGZyb20gdGhlIHN0b3JlLCBhbmQgcHJldmVudCBmdXJ0aGVyXG4gICAgICAgKiBlbWlzc2lvbiBvZiB2YWx1ZXMgZnJvbSB0aGUgb2JzZXJ2YWJsZS5cbiAgICAgICAqL1xuICAgICAgc3Vic2NyaWJlOiBmdW5jdGlvbiBzdWJzY3JpYmUob2JzZXJ2ZXIpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYnNlcnZlciAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCB0aGUgb2JzZXJ2ZXIgdG8gYmUgYW4gb2JqZWN0LicpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gb2JzZXJ2ZVN0YXRlKCkge1xuICAgICAgICAgIGlmIChvYnNlcnZlci5uZXh0KSB7XG4gICAgICAgICAgICBvYnNlcnZlci5uZXh0KGdldFN0YXRlKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVTdGF0ZSgpO1xuICAgICAgICB2YXIgdW5zdWJzY3JpYmUgPSBvdXRlclN1YnNjcmliZShvYnNlcnZlU3RhdGUpO1xuICAgICAgICByZXR1cm4geyB1bnN1YnNjcmliZTogdW5zdWJzY3JpYmUgfTtcbiAgICAgIH1cbiAgICB9LCBfcmVmW19zeW1ib2xPYnNlcnZhYmxlMlsnZGVmYXVsdCddXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sIF9yZWY7XG4gIH1cblxuICAvLyBXaGVuIGEgc3RvcmUgaXMgY3JlYXRlZCwgYW4gXCJJTklUXCIgYWN0aW9uIGlzIGRpc3BhdGNoZWQgc28gdGhhdCBldmVyeVxuICAvLyByZWR1Y2VyIHJldHVybnMgdGhlaXIgaW5pdGlhbCBzdGF0ZS4gVGhpcyBlZmZlY3RpdmVseSBwb3B1bGF0ZXNcbiAgLy8gdGhlIGluaXRpYWwgc3RhdGUgdHJlZS5cbiAgZGlzcGF0Y2goeyB0eXBlOiBBY3Rpb25UeXBlcy5JTklUIH0pO1xuXG4gIHJldHVybiBfcmVmMiA9IHtcbiAgICBkaXNwYXRjaDogZGlzcGF0Y2gsXG4gICAgc3Vic2NyaWJlOiBzdWJzY3JpYmUsXG4gICAgZ2V0U3RhdGU6IGdldFN0YXRlLFxuICAgIHJlcGxhY2VSZWR1Y2VyOiByZXBsYWNlUmVkdWNlclxuICB9LCBfcmVmMltfc3ltYm9sT2JzZXJ2YWJsZTJbJ2RlZmF1bHQnXV0gPSBvYnNlcnZhYmxlLCBfcmVmMjtcbn0iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5leHBvcnRzLmNvbXBvc2UgPSBleHBvcnRzLmFwcGx5TWlkZGxld2FyZSA9IGV4cG9ydHMuYmluZEFjdGlvbkNyZWF0b3JzID0gZXhwb3J0cy5jb21iaW5lUmVkdWNlcnMgPSBleHBvcnRzLmNyZWF0ZVN0b3JlID0gdW5kZWZpbmVkO1xuXG52YXIgX2NyZWF0ZVN0b3JlID0gcmVxdWlyZSgnLi9jcmVhdGVTdG9yZScpO1xuXG52YXIgX2NyZWF0ZVN0b3JlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZVN0b3JlKTtcblxudmFyIF9jb21iaW5lUmVkdWNlcnMgPSByZXF1aXJlKCcuL2NvbWJpbmVSZWR1Y2VycycpO1xuXG52YXIgX2NvbWJpbmVSZWR1Y2VyczIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jb21iaW5lUmVkdWNlcnMpO1xuXG52YXIgX2JpbmRBY3Rpb25DcmVhdG9ycyA9IHJlcXVpcmUoJy4vYmluZEFjdGlvbkNyZWF0b3JzJyk7XG5cbnZhciBfYmluZEFjdGlvbkNyZWF0b3JzMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2JpbmRBY3Rpb25DcmVhdG9ycyk7XG5cbnZhciBfYXBwbHlNaWRkbGV3YXJlID0gcmVxdWlyZSgnLi9hcHBseU1pZGRsZXdhcmUnKTtcblxudmFyIF9hcHBseU1pZGRsZXdhcmUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfYXBwbHlNaWRkbGV3YXJlKTtcblxudmFyIF9jb21wb3NlID0gcmVxdWlyZSgnLi9jb21wb3NlJyk7XG5cbnZhciBfY29tcG9zZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jb21wb3NlKTtcblxudmFyIF93YXJuaW5nID0gcmVxdWlyZSgnLi91dGlscy93YXJuaW5nJyk7XG5cbnZhciBfd2FybmluZzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF93YXJuaW5nKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG4vKlxuKiBUaGlzIGlzIGEgZHVtbXkgZnVuY3Rpb24gdG8gY2hlY2sgaWYgdGhlIGZ1bmN0aW9uIG5hbWUgaGFzIGJlZW4gYWx0ZXJlZCBieSBtaW5pZmljYXRpb24uXG4qIElmIHRoZSBmdW5jdGlvbiBoYXMgYmVlbiBtaW5pZmllZCBhbmQgTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJywgd2FybiB0aGUgdXNlci5cbiovXG5mdW5jdGlvbiBpc0NydXNoZWQoKSB7fVxuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0eXBlb2YgaXNDcnVzaGVkLm5hbWUgPT09ICdzdHJpbmcnICYmIGlzQ3J1c2hlZC5uYW1lICE9PSAnaXNDcnVzaGVkJykge1xuICAoMCwgX3dhcm5pbmcyWydkZWZhdWx0J10pKCdZb3UgYXJlIGN1cnJlbnRseSB1c2luZyBtaW5pZmllZCBjb2RlIG91dHNpZGUgb2YgTk9ERV9FTlYgPT09IFxcJ3Byb2R1Y3Rpb25cXCcuICcgKyAnVGhpcyBtZWFucyB0aGF0IHlvdSBhcmUgcnVubmluZyBhIHNsb3dlciBkZXZlbG9wbWVudCBidWlsZCBvZiBSZWR1eC4gJyArICdZb3UgY2FuIHVzZSBsb29zZS1lbnZpZnkgKGh0dHBzOi8vZ2l0aHViLmNvbS96ZXJ0b3NoL2xvb3NlLWVudmlmeSkgZm9yIGJyb3dzZXJpZnkgJyArICdvciBEZWZpbmVQbHVnaW4gZm9yIHdlYnBhY2sgKGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzAwMzAwMzEpICcgKyAndG8gZW5zdXJlIHlvdSBoYXZlIHRoZSBjb3JyZWN0IGNvZGUgZm9yIHlvdXIgcHJvZHVjdGlvbiBidWlsZC4nKTtcbn1cblxuZXhwb3J0cy5jcmVhdGVTdG9yZSA9IF9jcmVhdGVTdG9yZTJbJ2RlZmF1bHQnXTtcbmV4cG9ydHMuY29tYmluZVJlZHVjZXJzID0gX2NvbWJpbmVSZWR1Y2VyczJbJ2RlZmF1bHQnXTtcbmV4cG9ydHMuYmluZEFjdGlvbkNyZWF0b3JzID0gX2JpbmRBY3Rpb25DcmVhdG9yczJbJ2RlZmF1bHQnXTtcbmV4cG9ydHMuYXBwbHlNaWRkbGV3YXJlID0gX2FwcGx5TWlkZGxld2FyZTJbJ2RlZmF1bHQnXTtcbmV4cG9ydHMuY29tcG9zZSA9IF9jb21wb3NlMlsnZGVmYXVsdCddOyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IHdhcm5pbmc7XG4vKipcbiAqIFByaW50cyBhIHdhcm5pbmcgaW4gdGhlIGNvbnNvbGUgaWYgaXQgZXhpc3RzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIFRoZSB3YXJuaW5nIG1lc3NhZ2UuXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gd2FybmluZyhtZXNzYWdlKSB7XG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbiAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSk7XG4gIH1cbiAgLyogZXNsaW50LWVuYWJsZSBuby1jb25zb2xlICovXG4gIHRyeSB7XG4gICAgLy8gVGhpcyBlcnJvciB3YXMgdGhyb3duIGFzIGEgY29udmVuaWVuY2Ugc28gdGhhdCBpZiB5b3UgZW5hYmxlXG4gICAgLy8gXCJicmVhayBvbiBhbGwgZXhjZXB0aW9uc1wiIGluIHlvdXIgY29uc29sZSxcbiAgICAvLyBpdCB3b3VsZCBwYXVzZSB0aGUgZXhlY3V0aW9uIGF0IHRoaXMgbGluZS5cbiAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tZW1wdHkgKi9cbiAgfSBjYXRjaCAoZSkge31cbiAgLyogZXNsaW50LWVuYWJsZSBuby1lbXB0eSAqL1xufSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvaW5kZXgnKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9wb255ZmlsbCA9IHJlcXVpcmUoJy4vcG9ueWZpbGwnKTtcblxudmFyIF9wb255ZmlsbDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9wb255ZmlsbCk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxudmFyIHJvb3Q7IC8qIGdsb2JhbCB3aW5kb3cgKi9cblxuXG5pZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG4gIHJvb3QgPSBzZWxmO1xufSBlbHNlIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICByb290ID0gd2luZG93O1xufSBlbHNlIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICByb290ID0gZ2xvYmFsO1xufSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICByb290ID0gbW9kdWxlO1xufSBlbHNlIHtcbiAgcm9vdCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG59XG5cbnZhciByZXN1bHQgPSAoMCwgX3BvbnlmaWxsMlsnZGVmYXVsdCddKShyb290KTtcbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IHJlc3VsdDsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuXHR2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzWydkZWZhdWx0J10gPSBzeW1ib2xPYnNlcnZhYmxlUG9ueWZpbGw7XG5mdW5jdGlvbiBzeW1ib2xPYnNlcnZhYmxlUG9ueWZpbGwocm9vdCkge1xuXHR2YXIgcmVzdWx0O1xuXHR2YXIgX1N5bWJvbCA9IHJvb3QuU3ltYm9sO1xuXG5cdGlmICh0eXBlb2YgX1N5bWJvbCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdGlmIChfU3ltYm9sLm9ic2VydmFibGUpIHtcblx0XHRcdHJlc3VsdCA9IF9TeW1ib2wub2JzZXJ2YWJsZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0ID0gX1N5bWJvbCgnb2JzZXJ2YWJsZScpO1xuXHRcdFx0X1N5bWJvbC5vYnNlcnZhYmxlID0gcmVzdWx0O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRyZXN1bHQgPSAnQEBvYnNlcnZhYmxlJztcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59OyIsImNvbnN0IGFsZ2VicmEgPSByZXF1aXJlKCdhbGdlYnJhLmpzJylcbmNvbnN0IHsgY3JlYXRlU3RvcmUgfSA9IHJlcXVpcmUoJ3JlZHV4JylcblxuZ2xvYmFsLmFsZ2VicmEgPSBhbGdlYnJhXG5cbmNvbnN0IGluaXRpYWxTdGF0ZSA9IHtcbiAgc3RlcHM6IFtdLFxuICBzY29wZToge30sXG4gIGZvY3VzOiAwXG59XG5cbmZ1bmN0aW9uIHJlZHVjZXIgKHN0YXRlID0gaW5pdGlhbFN0YXRlLCBhY3Rpb24pIHtcbiAgc3dpdGNoIChhY3Rpb24udHlwZSkge1xuICAgIGNhc2UgJ0FERCBTVEVQJzpcbiAgICAgIHsgIC8vIGFkZCBzY29wZSB0byBhbGxvdyBgbGV0IHZhciA9IGAgaW5zaWRlIHN3aXRjaCBjYXNlXG4gICAgICAgIGxldCBudW0gPSBzdGF0ZS5zdGVwcy5sZW5ndGhcbiAgICAgICAgbGV0IGlucHV0ID0gJydcbiAgICAgICAgbGV0IG91dHB1dCA9ICcnXG4gICAgICAgIHN0YXRlLnN0ZXBzLnB1c2goeyBudW0sIGlucHV0LCBvdXRwdXQgfSlcbiAgICAgICAgc3RhdGUuZm9jdXMgPSBudW1cbiAgICAgICAgcmV0dXJuIHN0YXRlXG4gICAgICB9XG5cbiAgICBjYXNlICdTVEVQIElOUFVUJzpcbiAgICAgIHtcbiAgICAgICAgbGV0IG51bSA9IGFjdGlvbi5udW1cbiAgICAgICAgbGV0IGlucHV0ID0gYWN0aW9uLmlucHV0XG4gICAgICAgIGxldCBbbm9kZSwgb3V0cHV0XSA9IGV2YWx1YXRlSW5wdXQoaW5wdXQsIHN0YXRlLnNjb3BlKVxuICAgICAgICBzdGF0ZS5zdGVwc1tudW1dID0geyBudW0sIGlucHV0LCBub2RlLCBvdXRwdXQgfVxuICAgICAgICByZXR1cm4gc3RhdGVcbiAgICAgIH1cblxuICAgIGNhc2UgJ0ZPQ1VTJzpcbiAgICAgIHN0YXRlLmZvY3VzID0gYWN0aW9uLm51bVxuICAgICAgcmV0dXJuIHN0YXRlXG5cbiAgICBjYXNlICdGT0NVUyBERUNSRU1FTlQnOlxuICAgICAge1xuICAgICAgICBsZXQgZiA9IHN0YXRlLmZvY3VzIC0gMVxuICAgICAgICBzdGF0ZS5mb2N1cyA9IGYgPiAwID8gZiA6IDBcbiAgICAgICAgcmV0dXJuIHN0YXRlXG4gICAgICB9XG5cbiAgICBjYXNlICdGT0NVUyBJTkNSRU1FTlQnOlxuICAgICAge1xuICAgICAgICBsZXQgZiA9IHN0YXRlLmZvY3VzICsgMVxuICAgICAgICBzdGF0ZS5mb2N1cyA9IGYgPCBzdGF0ZS5zdGVwcy5sZW5ndGggPyBmIDogc3RhdGUuZm9jdXNcbiAgICAgICAgcmV0dXJuIHN0YXRlXG4gICAgICB9XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHN0YXRlXG4gIH1cbn1cblxuY29uc3Qgc3RvcmUgPSBjcmVhdGVTdG9yZShyZWR1Y2VyKVxuZ2xvYmFsLnN0b3JlID0gc3RvcmVcblxuc3RvcmUuc3Vic2NyaWJlKCgpID0+IHtcbiAgY29uc3QgX3N0ZXBzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0ZXBzJylcbiAgbGV0IHN0YXRlID0gc3RvcmUuZ2V0U3RhdGUoKVxuXG4gIF9zdGVwcy5pbm5lckhUTUwgPSAnJ1xuXG4gIHN0YXRlLnN0ZXBzLmZvckVhY2goc3RlcCA9PiB7XG4gICAgbGV0IGVsbSA9IFN0ZXAoc3RlcClcbiAgICBfc3RlcHMuYXBwZW5kQ2hpbGQoZWxtKVxuXG4gICAgaWYgKHN0YXRlLmZvY3VzID09PSBzdGVwLm51bSkge1xuICAgICAgZWxtLmNoaWxkTm9kZXNbMF0uZm9jdXMoKVxuICAgIH1cbiAgfSlcbn0pXG5cbnN0b3JlLmRpc3BhdGNoKHsgdHlwZTogJ0FERCBTVEVQJyB9KVxuXG5mdW5jdGlvbiBTdGVwIChzdGVwKSB7XG4gIGxldCBlbG0gPSBFbG0oJzxkaXYgY2xhc3M9c3RlcD48L2Rpdj4nKVxuXG4gIGxldCBpbnB1dCA9IElucHV0KHN0ZXAuaW5wdXQpXG5cbiAgLy8gZnVuY3Rpb24gb25VcEtleSAoZXZlbnQpIHtcbiAgLy8gICAvLyAzOCA9IHVwIGtleVxuICAvLyAgIGlmIChldmVudC5rZXlDb2RlICE9PSAzOCkge1xuICAvLyAgICAgcmV0dXJuXG4gIC8vICAgfVxuICAvLyAgIEZpbmQgcHJldmlvdXMgaW5wdXRcbiAgLy8gfVxuICAvLyBUT0RPOiB0YWIgY29tcGxldGlvbj9cblxuICBmdW5jdGlvbiBvbktleSAoZXZlbnQpIHtcbiAgICBsZXQga2MgPSBldmVudC5rZXlDb2RlXG4gICAgLy8gMTMgZW50ZXIsIDkgdGFiLCAzOCB1cCwgNDAgZG93blxuICAgIGlmICghKGtjID09PSAxMyB8fCBrYyA9PT0gOSB8fCBrYyA9PT0gMzggfHwga2MgPT09IDQwKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgIHN0b3JlLmRpc3BhdGNoKHtcbiAgICAgIHR5cGU6ICdTVEVQIElOUFVUJyxcbiAgICAgIG51bTogc3RlcC5udW0sXG4gICAgICBpbnB1dDogaW5wdXQudmFsdWVcbiAgICB9KVxuXG4gICAgaWYgKGtjID09PSAzOCB8fMKgZXZlbnQuc2hpZnRLZXkgJiYga2MgPT09IDkpIHtcbiAgICAgIHN0b3JlLmRpc3BhdGNoKHsgdHlwZTogJ0ZPQ1VTIERFQ1JFTUVOVCcgfSlcbiAgICB9IGVsc2UgaWYgKGtjID09PSA0MCkge1xuICAgICAgc3RvcmUuZGlzcGF0Y2goeyB0eXBlOiAnRk9DVVMgSU5DUkVNRU5UJyB9KVxuICAgIH0gZWxzZSBpZiAoIWV2ZW50LnNoaWZ0S2V5ICYmIHN0b3JlLmdldFN0YXRlKCkuc3RlcHMubGVuZ3RoIDw9IHN0ZXAubnVtICsgMSkge1xuICAgICAgc3RvcmUuZGlzcGF0Y2goeyB0eXBlOiAnQUREIFNURVAnIH0pXG4gICAgfSBlbHNlIGlmICghZXZlbnQuc2hpZnRLZXkpIHtcbiAgICAgIHN0b3JlLmRpc3BhdGNoKHsgdHlwZTogJ0ZPQ1VTIElOQ1JFTUVOVCcgfSlcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvbkNsaWNrICgpIHtcbiAgICBzdG9yZS5kaXNwYXRjaCh7IHR5cGU6ICdGT0NVUycsIG51bTogc3RlcC5udW0gfSlcbiAgfVxuXG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbktleSlcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvbkNsaWNrKVxuICBlbG0uYXBwZW5kQ2hpbGQoaW5wdXQpXG5cbiAgZWxtLmFwcGVuZENoaWxkKE91dHB1dChzdGVwLm91dHB1dCkpXG5cbiAgcmV0dXJuIGVsbVxufVxuXG5mdW5jdGlvbiBJbnB1dCAodmFsdWUpIHtcbiAgbGV0IGVsbSA9IEVsbShgPGlucHV0IHR5cGU9dGV4dD5gKVxuICBlbG0udmFsdWUgPSB2YWx1ZVxuICByZXR1cm4gZWxtXG59XG5cbmZ1bmN0aW9uIE91dHB1dCAoc3RyKSB7XG4gIHJldHVybiBFbG0oYDxkaXYgY2xhc3M9b3V0cHV0PiR7c3RyfTwvZGl2PmApXG59XG5cbmZ1bmN0aW9uIEVsbSAoaHRtbCkge1xuICBsZXQgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgZGl2LmlubmVySFRNTCA9IGh0bWxcbiAgcmV0dXJuIGRpdi5jaGlsZE5vZGVzWzBdXG59XG5cbmZ1bmN0aW9uIGV2YWx1YXRlSW5wdXQgKGlucHV0LCBzY29wZSkge1xuICBsZXQgbm9kZSwgb3V0cHV0XG4gIHRyeSB7XG4gICAgbm9kZSA9IGFsZ2VicmEucGFyc2UoaW5wdXQpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIG91dHB1dCA9IGVyci5tZXNzYWdlXG4gIH1cbiAgb3V0cHV0ID0gbm9kZSA/IG5vZGUudG9TdHJpbmcoKSA6ICcnXG4gIHJldHVybiBbIG5vZGUsIG91dHB1dCBdXG59XG4iXX0=
