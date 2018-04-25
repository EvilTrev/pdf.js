(function formswrapper() {

'use strict';

var globalScope = (typeof window === 'undefined') ? this : window;

globalScope.FormsDemo = (function FormsFunctionalityClosure() {

    var pdfObject;
    var data;
    var numpages;
    var currentPage;
    var docTarget;
    var elementsOnPage;

    var savePageData = function() {
        try {
            var tempData = PDFJS.FormFunctionality.getFormValues();
            for (var prop in tempData) {
                data[prop]= tempData[prop];
            }
        }
        catch (e) {
            alert(e.message);
        }
    }

    return {
        dumpDataToDiv: function(target, data) {
            var outputEl = document.getElementById(target);
            var string = '<table style="border:1px solid red">';
            Object.keys(data).forEach(function(key,index) {
                string = string + '<tr><td>' + key + '</td><td>' + data[key] + '</td></tr>';
            });
            string = string + '</table>';
            outputEl.innerHTML = string;
        },

        getPdfData: function(encode) {
            if (typeof encode === 'undefined') {
                encode = false;
            }
            savePageData();
            var postdata = {};
            var newName = '';
            for (var datarow in data) {
                if (encode) {
                    newName = encodeURIComponent(datarow);
                }
                else {
                    newName = datarow;
                }
                postdata[newName]=data[datarow];
            }
            return postdata;
        },

        loadPdf: function(target, pdfUrl) {
            try {
                docTarget = document.getElementById(target);
                var style = getComputedStyle(docTarget,null);
                var width = parseInt(style.getPropertyValue('width'),10);
                data = {};
                elementsOnPage = {};
                PDFJS.getDocument(pdfUrl).then(function(pdf) {
                    pdfObject = pdf;
                    numpages = pdfObject.numPages;

                    for (var i = 1; i<=numpages; i++) { // careful here: then is a promise, and will likely run AFTER the for loop. Don't use 'i' in then() as it will be wrong
                        pdfObject.getPage(i).then(function(page) {
                            var elements = PDFJS.FormFunctionality.returnFormElementsOnPage(page);
                            elementsOnPage[''+(page.pageIndex+1)] = elements;
                        });
                    }

                    currentPage=1;
                    // Using promise to fetch the page
                    pdfObject.getPage(1).then(function(page) {
                        PDFJS.FormFunctionality.render(width,false,page,docTarget,true,data);
                    });
                });
                return true;
            }
            catch(e) {
                alert(e.message);
            }
            return false;
        },

        getPageCount: function() {
            return numpages;
        },

        getPageElements: function(pageNumber) {
            if (typeof elementsOnPage[''+pageNumber] != 'undefined' ) {
                return elementsOnPage[''+pageNumber];
            }
            return [];
        },

        getAllPagesElements: function() {
            return elementsOnPage;
        },

        getPageForElement: function(elementId) {
            for (var i = 1; i<=numpages; i++) {
                if (typeof elementsOnPage[''+i] != 'undefined' ) {
                    var pageElements = elementsOnPage[''+i];
                    for (var j = 0; j < pageElements.length; j++) {
                        if (pageElements[j]==elementId) {
                            return i;
                        }
                    }
                }
            }
            return false;
        },

        getCurrentPage: function() {
            return currentPage;
        },

        getPreviousPage: function() {
            try {
                if (currentPage==1)
                    return 1;
                return currentPage-1;
            }
            catch(e) {
                alert(e.message);
            }
            return false;
        },

        getNextPage: function() {
            try {
                if (currentPage==numpages)
                    return currentPage;
                return currentPage+1;
            }
            catch(e) {
                alert(e.message);
            }
            return false;
        },

        loadPage: function(pageNumber) {
            try {
                savePageData();
                var style = getComputedStyle(docTarget,null);
                var width = parseInt(style.getPropertyValue('width'),10);
                docTarget.innerHTML ='';
                pdfObject.getPage(pageNumber).then(function(page) {
                    //PDFJS.FormFunctionality.render(300,300,page,target,true,{'LOST_TIME':true,'MEDICAL_HEALTH_CARE':false, 'Other': 'THIS IS VALUE','RADIO1':'1', 'STATES':'ME'});
                    PDFJS.FormFunctionality.render(width,false,page,docTarget,true,data);
                    currentPage=pageNumber;
                });
                return true;
            }
            catch(e) {
                alert(e.message);
            }
            return false;
        },

        getData: function() {
            if (typeof pdfObject != 'undefined') {
                try {
                    return PDFJS.FormFunctionality.getFormValues();
                }
                catch(e) {
                    alert(e.message);
                }
            }
            return false;
        },
    };
})();
}).call((typeof window === 'undefined') ? this : window);

window.onload = function(){
    FormsDemo.loadPdf('target','/forms/f1040.pdf');

};