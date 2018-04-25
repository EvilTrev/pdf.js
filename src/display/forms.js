
'use strict';

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('pdfjs/display/forms', ['exports', 'pdfjs/shared/util', 'pdfjs/shared/global'], factory);
  } else if (typeof exports !== 'undefined') {
    factory(exports, require('../shared/util.js'),
      require('../shared/global.js'));
  } else {
    factory((root.pdfjsDisplayForms = {}), root.pdfjsSharedUtil,
      root.pdfjsSharedGlobal);
  }
}(this, function (exports, sharedUtil, sharedGlobal) {

var Util = sharedUtil.Util; // @IAG Replace PDFJS.Util calls with this
var createPromiseCapability = sharedUtil.createPromiseCapability; // Maybe implement promises later

var FormFunctionality = (function FormFunctionalityClosure() {

    var containFontSize = false; // whether or not to contain font sizes in bounding boxes
    var _tabIndex = 1;
    var defaultScaleFontSize = '80%'; // set to a (string)number for a px amount, or a percentage for pencentage of height '80%'
    var defaultMultilineFontSize = '12'; // Currently I can't get the font size for multi-line items. Fall back

    var genericClosureOverrides = {}; // closures that render the controls. Can be used to render all DROP_DOWNS one way, for example
    var idClosureOverrides = {}; // closure that overrides any controls id (specifically the correctedId). For radio buttons, all that are part of one group will go to same closure. Grouping ID is not respected
    var idValueGetOverrides = {}; // closure that overrides getting data
	var postCreationTweak = false;

    var formFields = {};

    var postRenderHook = false;

    var fieldTypes = {
        UNSUPPORTED: false,
        CHECK_BOX: 'CHECK_BOX',
        DROP_DOWN: 'DROP_DOWN',
        PUSH_BUTTON: 'PUSH_BUTTON',
        RADIO_BUTTON: 'RADIO_BUTTON',
        TEXT: 'TEXT'
    };

    function assertValidControlClosure(closure) {
        if (typeof(closure)!='function') {
            throw "Passed item is not a function";
        }
        if (closure.length!=2) {
            throw 'Passed function must accept two arguments: itemProperties and viewport';
        }
        //var args = closure.toString ().match (/^\s*function\s+(?:\w*\s*)?\((.*?)\)/);
        //args = args ? (args[1] ? args[1].trim ().split (/\s*,\s*/) : []) : null;
        //if (args[0]!='itemProperties' || args[1]!='viewport') {
        //    throw 'Passed function must accept two arguments: itemProperties and viewport';
        //}
    }

	function assertValidControlTweak(closure) {
		if (typeof(closure)!='function') {
			throw "Passed item is not a function";
		}
		if (closure.length!=3) {
			throw 'Passed function must accept three arguments: fieldType, elementId and element';
		}
		//var args = closure.toString ().match (/^\s*function\s+(?:\w*\s*)?\((.*?)\)/);
		//args = args ? (args[1] ? args[1].trim ().split (/\s*,\s*/) : []) : null;
		//if (args[0]!='fieldType' || args[1]!='elementId' || args[2]!='element') {
		//	throw 'Passed function must accept three arguments: fieldType, elementId and element';
		//}
	}

    function assertValidIdValueClosure(closure) {
        if (typeof closure != 'function') {
            throw "Passed item is not a function";
        }
        if (closure.length != 1) {
            throw 'Passed function must accept one arguments: element';
        }
        //var args = closure.toString().match(/^\s*function\s+(?:\w*\s*)?\((.*?)\)/);
        //args = args ? args[1] ? args[1].trim().split(/\s*,\s*/) : [] : null;
        //if (args[0] != 'fieldType' || args[1] != 'elementId' || args[2] != 'element') {
        // throw 'Passed function must accept three arguments: fieldType, elementId and element';
        //}
    }

    function _isSelectMultiple(element) {
        for (var i=0, l = element.attributes.length; i<l; i++) {
            try {
                if (element.attributes[i].name == 'multiple')
                    return true;
            }
            catch (e) {}
        }
        return false;
    }

    function _createViewport(width, height, page, dpiRatio) {
        var actualWidth = page.pageInfo.view[2];
        var actualHeight = page.pageInfo.view[3];

        var scale;
        var viewport;

        if (typeof(width)=='number' && typeof(height)!='number') {
            scale = width/actualWidth;
            viewport = page.getViewport(scale * dpiRatio);
            return viewport;
        }
        if (typeof(width)!='number' && typeof(height)=='number') {
            scale = height/actualHeight;
            viewport = page.getViewport(scale * dpiRatio);
            return viewport;
        }
        // This one is special. Specifying a  width & height means setting bounds. Both are tested and the
        // pdf is not to go outside the max width or height
        if (typeof(width)=='number' && typeof(height)=='number') {
            scale = height/actualHeight;
            if (scale*actualWidth>width) { // too big, use other dimension's scale
                scale = width/actualWidth;
                viewport = page.getViewport(scale * dpiRatio);
                return viewport;
            }
            viewport = page.getViewport(scale * dpiRatio);
            return viewport;
        }
        viewport = page.getViewport(dpiRatio);
        return viewport;
    }

    function _extend(obj1, obj2) { // I do this because I don't want to rely on a base library like jQuery or underscore.js
        var obj3 = {};
        for (var prop in obj1) {
            obj3[prop] = obj1[prop];
        }
        for (var prop in obj2) {
            if (typeof(obj2[prop])!='undefined') { // don't let a rampant undefined override a value!
                obj3[prop] = obj2[prop];
            }
        }
        return obj3;
    }

    function _getFontSize(value,viewport) {
        try {
            if (typeof(value)=='number') {
                if (value<=0) {
                    if (Number(defaultScaleFontSize)!=0 && Number(defaultScaleFontSize)>0) {
                        return _getFontSize(defaultScaleFontSize,viewport);
                    }
                    return '80%';
                }
                return String(Math.round(value * viewport.fontScale))
            }
            if (typeof(value)=='string') {
                if (value.indexOf('%')!=-1) {
                    return value;
                }
                else {
                    return String(Math.round(Number(value) * viewport.fontScale));
                }
            }
            return '80%';
        }
        catch (e) {
            return '80%';
        }
    }

    function _getBasicFieldProperties(item, viewport) {
        var prop = {
            id: item.fullName,
            originalName: item.originalName,
            tabindex: _tabIndex++,
            type: itemType(item),
            fieldFlags: item.fieldFlags,
        };
        if (item.fullName.indexOf('.`')!=-1) {
            prop.correctedId = item.fullName.substring(0,item.fullName.indexOf('.`'));
            prop.groupingId = item.fullName.substring(item.fullName.indexOf('.`')+2);
            prop.isGroupMember = true;
        }
        else {
            prop.correctedId = item.fullName;
            prop.isGroupMember = false;
        }
        try {
            if ('fontSize' in item) {
                if (typeof(item.fontSize)=='number' || typeof(item.fontSize)=='string') {
                    prop.fontSize = _getFontSize(item.fontSize,viewport);
                }
                else {
                     prop.fontSize = _getFontSize(defaultScaleFontSize,viewport);
                }
            }
            else {
                prop.fontSize = _getFontSize(defaultScaleFontSize,viewport);
            }
        }
        catch (e) {
            prop.fontSize = '60%'; // hardcoded know working fallback. A size of the display bounding box (which is the normal PDF way)
        }
        switch (item.textAlignment) {
            case 0:
                prop.textAlignment = 'left';
                break;
            case 1:
                prop.textAlignment = 'center';
                break;
            case 2:
                prop.textAlignment = 'right';
                break;
            default:
                prop.textAlignment = 'left';
                break;
        }

        return prop;
    }

    function _getDisplayFieldProperties(item, viewport) {
        var fieldRect = viewport.convertToViewportRectangle(item.rect);
        var rect = Util.normalizeRect(fieldRect);
        return {
            x: Math.floor(rect[0]),
            y: Math.floor(rect[1]),
            width: Math.ceil(rect[2] - rect[0])+.5,
            height: Math.ceil(rect[3] - rect[1])+.5
        };
    }

    function _getCheckBoxProperties(item, viewport, values, basicData) {
        var selected = item.selected;
		var v = values[basicData.id];
		switch (typeof v)
		{
			case "string":
			{
				// We were passed a string, chances are this person knows the export_value
				selected = (item.options.indexOf(v)>0);		// 2nd option is the "checked" state
				break;
			}
			case "boolean":
			{
				// We were passed a boolean, just use it as is
				selected = v;
				break;
			}
		}
        return {
			options: item.options,
            selected: selected,
            readOnly: item.readOnly,
        };
    }

    function _getPushButtonProperties(item,viewport, values, basicData) {
        return {}; // nothing right now.
    }

    function _getRadioButtonProperties(item, viewport, values, basicData) {
        var selected = item.selected;
        if (basicData.correctedId in values) {
			var v = values[basicData.correctedId];
			selected = (item.options.indexOf(v)>0);
        }
        return {
			options: item.options,
            selected: selected,
            readOnly: item.readOnly,
        };
    }

    function _getTextProperties(item, viewport, values, basicData) {
        var value = item.fieldValue;
        if (item.fullName in values) {
            value = values[item.fullName];
        }
        return {
            value: value,
            multiLine: item.multiLine,
            password: item.password,
            fileUpload: item.fileUpload,
            richText: item.richText,
            readOnly: item.readOnly,
            maxlen: item.maxlen,
        };
    }

    function _getDropDownProperties(item, viewport, values, basicData) {
        var value = item.fieldValue;
        if (item.fullName in values) {
            value = values[item.fullName];
        }
        return {
            value: value,
            options: item.options,
            multiSelect: item.multiSelect,
            allowTextEntry: item.allowTextEntry,
            readOnly: item.readOnly,
        };
    }

    function getFieldProperties(item, viewport, values) {
        var basicData = _getBasicFieldProperties(item, viewport);
        basicData = _extend(_getDisplayFieldProperties(item, viewport),basicData);
        if (basicData.fontSize.indexOf('%')!=-1) { // correct font % here. Must be done post merger
            var percentage = basicData.fontSize.substring(0,basicData.fontSize.indexOf('%'))/100;
            basicData.fontSize = Math.round(basicData.height * percentage);
            basicData.fontSizeControl = Math.round(basicData.height * percentage - Math.ceil(4*viewport.scale)); // font size for a control (input, drop down) in the positional div
        }
        else {
            basicData.fontSizeControl = basicData.fontSize;
        }
        switch (basicData.type) {
            case fieldTypes.CHECK_BOX:
                basicData = _extend(basicData,_getCheckBoxProperties(item, viewport, values, basicData));
                break;
            case fieldTypes.DROP_DOWN:
                basicData = _extend(basicData,_getDropDownProperties(item, viewport, values, basicData));
                break;
            case fieldTypes.PUSH_BUTTON:
                basicData = _extend(basicData,_getPushButtonProperties(item, viewport, values, basicData));
                break;
            case fieldTypes.RADIO_BUTTON:
                basicData = _extend(basicData,_getRadioButtonProperties(item, viewport, values, basicData));
                break;
            case fieldTypes.TEXT:
                basicData = _extend(basicData,_getTextProperties(item, viewport, values, basicData));
                break;
        }
        return basicData;
    }

    function getPositionContainer(itemProperties, viewport) {
        var containerDiv = document.createElement('div');
        containerDiv.style.left = itemProperties.x + 'px';
        containerDiv.style.top = itemProperties.y + 'px';
        containerDiv.style.width = Math.floor(itemProperties.width) + 'px';
        containerDiv.style.height = Math.floor(itemProperties.height) + 'px';
        containerDiv.style.fontSize = itemProperties.fontSize + 'px';
        containerDiv.style.textAlign = itemProperties.textAlignment;
        containerDiv.style.position = 'absolute';
        containerDiv.style.border = '0 none';
        return containerDiv;
    }

	// These are the default creation routines for form components (unless overrides are provided by id or type)
	var defaultCreationRoutines = {};

	defaultCreationRoutines[fieldTypes.CHECK_BOX] = function(itemProperties, viewport) {
		var control = document.createElement('input');
		control.type = 'checkbox';
		control.value = itemProperties.options[1];		// Checkboxes are often Off/Yes, however this is a custom field controlled by export_value
        control.id = itemProperties.id;
        control.name = itemProperties.id;
		control.style.padding = '0';
		control.style.margin = '0';
		control.style.marginLeft = itemProperties.width/2-Math.ceil(4*viewport.scale)+'px';
		if (itemProperties.selected)
			control.checked='checked';
		if (itemProperties.readOnly)
			control.disabled='disabled';
		return control;
	};

	defaultCreationRoutines[fieldTypes.RADIO_BUTTON] = function(itemProperties, viewport) {
		var control = document.createElement('input');
		control.type = 'radio';
		control.value = itemProperties.options[1];		// Radio buttons have an Off/Yes style value, however Yes is usually a unique ID unless grouping is turned on
        control.id = itemProperties.correctedId+'.'+itemProperties.groupingId;
		control.name = itemProperties.correctedId;		// Name is used to group radio buttons
		control.style.padding = '0';
		control.style.margin = '0';
		control.style.marginLeft = itemProperties.width/2-Math.ceil(4*viewport.scale)+'px';
		if (itemProperties.selected)
			control.checked='checked';
		if (itemProperties.readOnly)
			control.disabled='disabled';
		return control;
	};

	defaultCreationRoutines[fieldTypes.TEXT] = function(itemProperties, viewport) {
		var control;
		if (itemProperties.multiLine) {
			control = document.createElement('textarea');
			control.style.resize = "none";
		}
		else {
			control = document.createElement('input');
			if (itemProperties.fileUpload) {
				control.type='file';
			}
			else if (itemProperties.password) {
				control.type='password';
			}
			else {
				control.type='text';
			}
		}
		control.style.width = Math.floor(itemProperties.width-3) + 'px'; // small amount + borders
		control.style.height = Math.floor(itemProperties.height) + 'px'; // small amount + borders
		control.style.textAlign = itemProperties.textAlignment;
		if (!itemProperties.multiLine) {
			if (containFontSize && Math.floor(itemProperties.fontSizeControl)>=Math.floor(itemProperties.height-2)) {
				control.style.fontSize = Math.floor(itemProperties.height-3) + 'px';
			}
			else {
				if (containFontSize) {
					control.style.fontSize = itemProperties.fontSizeControl + 'px';
				}
				else {
					control.style.fontSize = itemProperties.fontSize + 'px';
				}
			}
		}
		else {
			if (containFontSize) {
				control.style.fontSize = itemProperties.fontSizeControl + 'px';
			}
			else {
				control.style.fontSize = itemProperties.fontSize + 'px';
			}
		}
		control.style.padding = '0';
		control.style.margin = '0';
		control.style.border = '1px solid #E6E6E6';
		control.style.display = 'block';
		if (itemProperties.maxlen) {
			control.maxLength=itemProperties.maxlen;
		}
		if (itemProperties.readOnly) {
			control.readOnly = true;
			control.style.cursor = "not-allowed";
		}
		control.value = itemProperties.value;
        control.id = itemProperties.id;
        control.name = itemProperties.id;
		return control;
	};

	defaultCreationRoutines[fieldTypes.DROP_DOWN] = function(itemProperties, viewport) {
		var control = document.createElement('select');
		if (itemProperties.multiSelect)
			control.multiple=true;
		control.style.width = Math.floor(itemProperties.width-3) + 'px'; // small amount + borders
		control.style.height = Math.floor(itemProperties.height) + 'px'; // small amount + borders
		control.style.textAlign = itemProperties.textAlignment;
        control.id = itemProperties.id;
        control.name = itemProperties.id;
		if (Math.floor(itemProperties.fontSizeControl)>=Math.floor(itemProperties.height-2)) {
			control.style.fontSize = Math.floor(itemProperties.height-3) + 'px';
		}
		else {
			control.style.fontSize = itemProperties.fontSizeControl + 'px';
		}
		control.style.border = '1px solid #E6E6E6';
		control.style.display = 'block';
		if (itemProperties.options) {
			for (var option in itemProperties.options) {
				var optionElement = document.createElement('option');
				optionElement.value = itemProperties.options[option]['value'];
				optionElement.innerHTML = itemProperties.options[option]['text'];
				if (typeof(itemProperties.value)=='object') { // multiple selected values. To be implemented

				}
				else if(itemProperties.value==itemProperties.options[option]['value']) {
					optionElement.selected=true;
				}
				control.appendChild(optionElement);
			}

		}
		if (itemProperties.readOnly)
		{
			control.disabled='disabled';
			control.style.cursor = "not-allowed";
		}
		return control;
	};

    function itemType(item) {
        if (item.subtype=='Widget') {
            switch(item.fieldType) {
                case 'Tx':
					if (item.paperMetaData) break; // PaperMetaData means a qrcode, datamatrix or similar... ignored
                    return fieldTypes.TEXT; //text input
                    break;
                case 'Btn':
                    if ((item.fieldFlags & 32768) || (item.fieldFlags & 49152)) {
                        return fieldTypes.RADIO_BUTTON; //radio button
                    }
                    else if (item.fieldFlags & 65536) {
                        return fieldTypes.PUSH_BUTTON; //push button
                    }
                    else {
                        return fieldTypes.CHECK_BOX;  //checkbox
                    }
                    break;
                case 'Ch': // choice
                    return fieldTypes.DROP_DOWN; //drop down
                    break;
            }
        }
        return fieldTypes.UNSUPPORTED;
    }

    function resetFormFields() {
        formFields = {
            'CHECK_BOX': {},
            'TEXT': {},
            'RADIO_BUTTON': {},
            'DROP_DOWN': {}
        };
    }

    function determineControlType(control) {
		var nodeName = control.nodeName.toLowerCase();
        if (nodeName=='input') {
            switch (control.type.toLowerCase()) {
                case 'radio' : return fieldTypes.RADIO_BUTTON;
                case 'checkbox' : return fieldTypes.CHECK_BOX;
            }
        }
        else if (nodeName=='textarea') {
            return fieldTypes.TEXT;
        }
        else if (nodeName=='select') {
            return fieldTypes.DROP_DOWN;
        }
        return fieldTypes.TEXT;
    }

	function renderForm(div, page, viewport, values) {

		// Remove any elements we've been holding on to
		resetFormFields();
		page.getAnnotations().then(function(items) {
			items.forEach(function(item) {
				var fieldType = itemType(item);
				if (fieldType) {

					// Can we create a control?
					var fieldData = getFieldProperties(item, viewport, values);
					var creationRoutine = idClosureOverrides[fieldData.correctedId] ||
										  genericClosureOverrides[fieldType] ||
										  defaultCreationRoutines[fieldType];
					var control = creationRoutine ? creationRoutine(fieldData, viewport) : undefined;

					// If we created a control, add it to a position container, and then the domain
					if (control) {

						// Do we want to perform any tweaks?
						if (postCreationTweak) postCreationTweak(fieldType,fieldData.correctedId,control);

						var container = getPositionContainer(fieldData, viewport);
						container.appendChild(control);
						fieldType = determineControlType(control);
						switch (fieldType) {
							case fieldTypes.RADIO_BUTTON :
								formFields[fieldType][fieldData.correctedId] = formFields[fieldType][fieldData.correctedId] || [];
								formFields[fieldType][fieldData.correctedId].push(control);
								break;
							default:
								formFields[fieldType][fieldData.correctedId] = control;
								break;
						}
						div.appendChild(container);
					}
				}
			});
			if (postRenderHook) postRenderHook();
		});

	}

    return {

        clearControlRendersById: function() {
            idClosureOverrides = {};
        },

        clearControlRendersByType: function() {
            genericClosureOverrides = {};
        },

        clearIdValueOverride: function () {
            idValueGetOverrides = {};
        },

        setPostRenderHook: function(hook) {
            postRenderHook = hook;
        },

        /**
         * A function that will render all the form elements for a particular form element type (CHECK_BOX, TEXT, DROP_DOWN or RADIO_BUTTON)
         * @param {function} closure A function with parameters 'itemProperties' and 'viewport' that will render a form element and return the node and NOT a rendered string
         * @param {type} type The type of form element to render (CHECK_BOX, TEXT, DROP_DOWN or RADIO_BUTTON)
         */
        setControlRenderClosureByType: function(closure,type) {
            if (type!='CHECK_BOX' && type!='TEXT' && type!='DROP_DOWN' && type!='RADIO_BUTTON') {
                throw "type must be one of the following: CHECK_BOX, TEXT, DROP_DOWN, RADIO_BUTTON";
            }
            if (!closure) {
                try {
                    delete genericClosureOverrides[type];
                } catch (e) {}
            }
            else {
                assertValidControlClosure(closure);
                genericClosureOverrides[type]=closure;
            }
        },

        /**
         * A function that will render one form element that matches the specified form element id
         * @param {function} closure A function with parameters 'itemProperties' and 'viewport' that will render a form element and return the node and NOT a rendered string
         * @param {string} id The id of the form element we wish to render in the closure
         */
        setControlRenderClosureById: function(closure,id) {
            if (!closure) {
                try {
                    delete idClosureOverrides[id];
                } catch (e) {}
            }
            else {
                assertValidControlClosure(closure);
                idClosureOverrides[id]=closure;
            }
        },

		/**
		 * Provide a function that will be given a chance to tweak a control after it is created (custom css, angular controls etc could be added here)
		 * @param {function} postCallback A function with parameters 'filedType', 'elementId' and 'element' that will have chance to customize the field and return nothing
		 */
		setPostCreationTweak: function(postCallback) {
			if (postCallback) assertValidControlTweak(postCallback);
			postCreationTweak = postCallback;
		},

        /**
         * A function that will allow overriding of getting values from form. Useful when fully overriding element rendering
         * from one type to another (checkbox to say drop down)
         * @param {function} closure A function with parameters 'element' that will return the value of the dom form element
         * @param {string} id The id of the form element we wish to render in the closure
         */
        setIdValueOverride: function(closure, id) {
            if (!closure) {
                try {
                    delete idValueGetOverrides[id];
                } catch (e) {}
            } else {
                assertValidIdValueClosure(closure);
                idValueGetOverrides[id] = closure;
            }
        },

        /**
         * @return {array} An array of values of the form elements in format [elementId]=value
         */
        getFormValues: function() {

			// Process to visit each element in a set of them
			var values = {};
			var visitElements = function(set, action) {
				var elementIds = Object.keys(set);
				elementIds.forEach(function(elementId){
					var element = set[elementId];
					if (element) action(elementId,element);
				});
			};

			// Visit each checkbox
			visitElements(formFields[fieldTypes.CHECK_BOX],function(elementId,element) {
                if (typeof(idValueGetOverrides[elementId])!='undefined') {
                    values[elementId]=idValueGetOverrides[elementId](element);
                }
                else {
                    values[elementId] = element.checked ? true : false;
                }
			});

			// Visit each text field
			visitElements(formFields[fieldTypes.TEXT],function(elementId,element) {
                if (typeof(idValueGetOverrides[elementId])!='undefined') {
                    values[elementId]=idValueGetOverrides[elementId](element);
                }
                else {
                    values[elementId] = element.value;
                }
			});

			// Visit each text drop down
			visitElements(formFields[fieldTypes.DROP_DOWN],function(elementId,element) {
                if (typeof(idValueGetOverrides[elementId])!='undefined') {
                    values[elementId]=idValueGetOverrides[elementId](element);
                }
                else {
                    if (_isSelectMultiple(element)) {
                        var valueObject = {};
                        for (var i = 0; i < element.length; i++) {
                            if (element[i].selected) {
                                valueObject[element[i].value] = element[i].value;
                            }
                        }
                        values[elementId] = valueObject;
                    } else {
                        values[elementId] = element.options[element.selectedIndex].value;
                    }
                }
			});

			// Visit each radio button
			visitElements(formFields[fieldTypes.RADIO_BUTTON],function(elementId,element) {
                if (typeof(idValueGetOverrides[elementId])!='undefined') {
                    values[elementId]=idValueGetOverrides[elementId](element);
                }
                else {
                    element.some(function (r) {
                        if (r.checked)
                            values[elementId] = r.value;
                        return r.checked;
                    });
                }
			});

			// Done!
			return values;
        },
        /**
         * @param {number} width A width to render - false to not specify width
         * @param {number} height A height to render - false to not specify height
         * @param {objec} page A page to render
         * @param {node} target A node reference to a document element to render into
         * @param {bool} doForm Whether or not to draw the form - defaults to true
         * @param {array} values Optional array of values to place in the form elements
         */
        render: function (width, height, page, target, doForm, values) {
            _tabIndex = 1;

            if (typeof(doForm)!='boolean') {
                doForm = true;
            }
            if (typeof(values)!='object') {
                values = {};
            }
            if (typeof(width)!='number' && typeof(height)!='number') {
                throw "at least one parameter must be specified as a number: width, height";
            }
            //
            // Get viewport
            //
            var viewport = _createViewport(width, height, page, 1.0);
            //
            // Page Holder
            //
            var pageHolder = document.createElement('div');
            pageHolder.style.width = viewport.width + 'px';
            pageHolder.style.height = viewport.height + 'px';
			if (postCreationTweak) postCreationTweak("PAGE","page",pageHolder);
            target.appendChild(pageHolder);
            target.style.position = 'relative';
            //
            // Add canvas
            //
            var canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            pageHolder.appendChild(canvas);
            canvas.height = viewport.height;
            canvas.width = viewport.width;

			// Tweak canvas to support hi-dpi rendering (without affecting the form fields positioning)
			var context = canvas.getContext('2d');
			var devicePixelRatio = window.devicePixelRatio || 1;
			var backingStoreRatio = context.webkitBackingStorePixelRatio ||
									context.mozBackingStorePixelRatio ||
									context.msBackingStorePixelRatio ||
									context.oBackingStorePixelRatio ||
									context.backingStorePixelRatio || 1;
			var ratio = devicePixelRatio / backingStoreRatio;
			canvas.style.width = canvas.width + "px";
			canvas.style.height = canvas.height + "px";
			canvas.width = canvas.width * ratio;
			canvas.height = canvas.height * ratio;
			if (postCreationTweak) postCreationTweak("CANVAS","canvas",canvas);

            //
            // Render PDF page into canvas context
            //
            var renderContext = {
                canvasContext: context,
                viewport: _createViewport(width, height, page, ratio),
				intent: doForm ? "display" : "print",
            };
			// Render the page, and optionally the forms overlay
			page.render(renderContext);
			if (doForm) {
				var formHolder = document.createElement('form');
				formHolder.style.position = 'absolute';
				formHolder.style.top = '0';
				formHolder.style.left = '0';
				formHolder.height = viewport.height;
				formHolder.width = viewport.width;
				if (postCreationTweak) postCreationTweak("FORM","form",formHolder);
				pageHolder.appendChild(formHolder);
				renderForm(formHolder, page, viewport, values);
			}
        },

        returnFormElementsOnPage: function(page) {
            var elements = [];

            page.getAnnotations().then(function(items) {
                items.forEach(function(item) {
                    var fieldType;
                    if ((fieldType=itemType(item))!= fieldTypes.UNSUPPORTED) {
                        elements.push(item.fullName);
                    }
                });
            });

            return elements;
        }
    }
})();

exports.FormFunctionality = FormFunctionality;
}));