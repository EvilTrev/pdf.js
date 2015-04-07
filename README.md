# PDF.js / pdf.js.forms

pdf.js.forms is a fork of [PDF.js](https://github.com/mozilla/pdf.js). The purpose of this fork was to implement fillable
web forms of pdf.forms using PDF.js. The base changes all occur in core\annotation.js
and display\forms.js. Rendering is still entirely done through pdf.js, _except form
widgets are no longer rendered graphically_ by pdf.js. Instead, a second layer with
web form elements is rendered over the canvas.

## TO USE FORMS:
To render a form use the PDFJS.FormFunctionality.render call. A width or height can
be specified, if both are specified this creates a bounding box that the pdf will fit
inside of.

        $var target = document.getElementById('target');
        $pdf.getPage(1).then(function(page) {
        $    PDFJS.FormFunctionality.render(800,800,page,target);
        $});

A page may be rendered without rendering the form. This is seemingly identical to pdf.js's
normal page render except that the scaling math is done for you if you wish to render to
a bounded box. For example say you wish to render a page no wider than 200 pixels or no
taller than 200 pixels, such as for a thumbnail, but not render the form you may do the
following call:

        $ PDFJS.FormFunctionality.render(200,200,page,target,false);

Either of the first two size parameters may be set to either a number, or false, but at
least one must be specified. If only one is specified, the other parameter will be treated
as unlimited. An example where we want a maximum width of 800, but don't care how tall

        $ PDFJS.FormFunctionality.render(800,false,page,target);

The values in the form elements may be overriden at render time by passing in an object
with alternate values.

        $ var values {'ADDR1': '21 Jump Street', 'CITY': 'San Marino'};
        $ PDFJS.FormFunctionality.render(800,800,page,target,true,values);

The values in the form may be retrieved manually of course outside of the pdf.js.forms library,
but there is also a call to simplify retrieval of those values. The function will return an
array of values of the form elements in format \[elementId\]=value.

        $ var values = PDFJS.FormFunctionality.getFormValues();

The forms library also allows the rendering of a particular element (as defined by id) or of
a class of elements to be handled by a closure, or function. For example, to have all
text elements rendered by closure, and not by the base library.

        $ var myClosure = function(itemProperties,viewport) {
        $     control = document.createElement('input');
        $     // set some stuff
        $     return control;
        $ };
        $ PDFJS.FormFunctionality.setControlRenderClosureByType(myClosure,'TEXT');

The basic types are:
+ CHECK_BOX - Check boxes
+ TEXT - All _input_ controls of type text, file and password as well as _textarea_s
+ DROP_DOWN - Regular drop downs and multiselects
+ RADIO_BUTTON - Radio buttons

A closure may be specified for just on element, based on id as well. This might be useful
in many scenarios, including scenarios where you wish to alter the basic nature of an element,
such as turning a text box for Country into a drop down.

Depending on the source element type, the properties that define the element can vary. All
elements will have the following properties defined. Note that all diplay type values are scales
to the viewport:

+ id - The id of the item, coming from the fullName property in the source
+ originalName - An unaltered original name from the pdf
+ tabindex - An auto generated tab index
+ type - the type of the item; can be CHECK_BOX, TEXT, DROP_DOWN, RADIO_BUTTON or PUSH_BUTTON. Currently PUSH_BUTTONS are ignored
+ fieldFlags - The flags from the underlaying PDF document for the widget
+ correctedId - An id that drops any grouping data from the fullName property. Often in radio buttons. If not found
it matches the id property
+ groupingId - The grouping id (usually a number) that indicates a unique key for the widget in the group. If not
part of a group, this will be zero.
+ isGroupMember - If this widget is part of a group
+ fontSize - The size of the font, applied to the positional div
+ textAlignment - The text alignment
+ fontSizeControl - A font size that has been appropriately scaled to match the size of the control it should be embedded in.
This can come from the definition in the PDF if it was specified, otherwise an attempt is made to calculate it to ensure it fits
in the control sensibly. This is also calculated to make multi-line text areas not look crazy
+ x - The X position of the element
+ y - The Y position of the element
+ width - The width of the element
+ height - The height of the element

Additionally, each of the basic element types will have their own properties.

#### Checkboxes (CHECK_BOX)

+ selected - If the checkbox item is selected

#### Texts (TEXT)

+ value - The value of the element
+ multiLine - If the text element is multiple lines, aka a text area
+ password - If the text element is a password element
+ fileUpload - If the text element is a file element
+ richText - If the text element is a rich text element
+ maxlen - The maximum length of the value, if any

#### Selects (DROP_DOWN)

+ value - The value of the element
+ options - The selectable choice values/source of options for the element. Each option consists of an object with
a 'value' and 'text' property.
+ multiSelect - If the element is a multi-select element
+ allowTextEntry - If the element allows entry of an item not in the list of options. (Currently not supported by
the default element renderers in the library).

#### Radio Buttons (RADIO_BUTTON)

+ selected - If the radio  button item is selected

## Notes
+ Since the form elements are basic html elements, the library does not provide any simplification
of access to the html form elements, such as value setting functions on the fly. The only exceptions
to this are that the default values may be passed on render, and the values may be retrieved en masse
using the getFormValues() function.

+ When defining your own closures to handle rendering, note that you do not need to position the element yourself.
Each element when returned from the closure will then be placed in a positional element that itself will ensure the
elements placement on the pdf.

+ If choosing to create a closure for rendering radio buttons, the following code is highly recommended as the basis
of the radio button element:

        $ var control = document.createElement('input');
        $ control.type='radio';
        $ control.value = itemProperties.groupingId;
        $ control.id = itemProperties.correctedId+'.'+itemProperties.groupingId;
        $ control.name = itemProperties.correctedId;

## Gotchas
+ Currently the form library does not get the _default_ selected values for multiple-select choice
controls from the base pdf.

+ Radio buttons and check boxes do not scale reliably in most browsers. As a result the library does not
try to scale the actual control, but will center it in the space a scaled control would have occupied.
If you wish to scale these controls, create your own control generation function as set it using
setControlRenderClosureByType().

## >> END FORMS SPECIFIC README <<
## >> BEGIN BASIC PDF.JS README <<

PDF.js is a Portable Document Format (PDF) viewer that is built with HTML5.

PDF.js is community-driven and supported by Mozilla Labs. Our goal is to
create a general-purpose, web standards-based platform for parsing and
rendering PDFs.

## Contributing

PDF.js is an open source project and always looking for more contributors. To
get involved checkout:

+ [Workflow](https://github.com/mozilla/pdf.js/wiki/Contributing)
+ [Style Guide](https://github.com/mozilla/pdf.js/wiki/Style-Guide)
+ [FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions)
+ [Good Beginner Bugs](https://github.com/mozilla/pdf.js/issues?direction=desc&labels=5-good-beginner-bug&page=1&sort=created&state=open)
+ [Priorities](https://github.com/mozilla/pdf.js/milestones)
+ [Attend a Public Meeting](https://github.com/mozilla/pdf.js/wiki/Weekly-Public-Meetings)

For further questions or guidance feel free to stop by #pdfjs on
irc.mozilla.org.

## Getting Started

### Online demo

+ http://mozilla.github.io/pdf.js/web/viewer.html

### Browser Extensions

#### Firefox

PDF.js is built into version 19+ of Firefox, however one extension is still available:

+ [Development Version](http://mozilla.github.io/pdf.js/extensions/firefox/pdf.js.xpi) - This version is updated every time new code is merged into the PDF.js codebase. This should be quite stable but still might break from time to time.

#### Chrome and Opera

The Chromium extension is still somewhat experimental but it can be installed two
ways:

+ [Unofficial Version](https://chrome.google.com/webstore/detail/pdf-viewer/oemmndcbldboiebfnladdacbdfmadadm) - *This extension is maintained by a PDF.js contributor.*
+ Build Your Own - Get the code as explained below and issue `node make chromium`. Then open
Chrome, go to `Tools > Extension` and load the (unpackaged) extension from the
directory `build/chromium`.

The version of the extension for the Opera browser can be found at the [Opera add-ons catalog](https://addons.opera.com/en/extensions/details/pdf-viewer/).

## Getting the Code

To get a local copy of the current code, clone it using git:

    $ git clone git://github.com/mozilla/pdf.js.git pdfjs
    $ cd pdfjs

Next, you need to start a local web server as some browsers don't allow opening
PDF files for a file:// url:

    $ node make server

You can install Node via [nvm](https://github.com/creationix/nvm) or the
[official package](http://nodejs.org). If everything worked out, you can now
serve

+ http://localhost:8888/web/viewer.html

You can also view all the test pdf files on the right side serving

+ http://localhost:8888/test/pdfs/?frame

## Building PDF.js

In order to bundle all `src/` files into two productions scripts and build the generic
viewer, issue:

    $ node make generic

This will generate `pdf.js` and `pdf.worker.js` in the `build/generic/build/` directory.
Both scripts are needed but only `pdf.js` needs to be included since `pdf.worker.js` will
be loaded by `pdf.js`. If you want to support more browsers than Firefox you'll also need
to include `compatibility.js` from `build/generic/web/`. The PDF.js files are large and
should be minified for production.

## Learning

You can play with the PDF.js API directly from your browser through the live
demos below:

+ [Hello world](http://mozilla.github.io/pdf.js/examples/learning/helloworld.html)
+ [Simple reader with prev/next page controls](http://mozilla.github.io/pdf.js/examples/learning/prevnext.html)

The repo contains a hello world example that you can run locally:

+ [examples/helloworld/](https://github.com/mozilla/pdf.js/blob/master/examples/helloworld/)

For an introduction to the PDF.js code, check out the presentation by our
contributor Julian Viereck:

+ http://www.youtube.com/watch?v=Iv15UY-4Fg8

You can read more about PDF.js here:

+ http://andreasgal.com/2011/06/15/pdf-js/
+ http://blog.mozilla.com/cjones/2011/06/15/overview-of-pdf-js-guts/

Even more learning resources can be found at:

+ https://github.com/mozilla/pdf.js/wiki/Additional-Learning-Resources

## Questions

Check out our FAQs and get answers to common questions:

+ https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions

Talk to us on IRC:

+ #pdfjs on irc.mozilla.org

Join our mailing list:

+ dev-pdf-js@lists.mozilla.org

Subscribe either using lists.mozilla.org or Google Groups:

+ https://lists.mozilla.org/listinfo/dev-pdf-js
+ https://groups.google.com/group/mozilla.dev.pdf-js/topics

Follow us on twitter: @pdfjs

+ http://twitter.com/#!/pdfjs

Weekly Public Meetings

+ https://github.com/mozilla/pdf.js/wiki/Weekly-Public-Meetings
