var _   = require('underscore'),
    fs  = require('fs');

module.exports = function(folder, contents) {

    var contentMap;

    var schemaIdsMap;
    var currentSchemaPath;

    /*
     * resolveSchemaPath - try to resolve reference to a sub-schema
     * within schema (document)
     * // TODO current assumes that `#` or `#root` component of relative path (fragment) is not included in the list of segments
     * @schemaMap
     *   map of schema
     * @refSegments
     *   array of segments in relative reference
     * @return
     *   map of schema addressed by relative reference or
     *   undefined if the path is not found in document
     */
    function resolveSchemaPath(schemaMap, refSegments) {
        var currSchema;
        var refPathSegment = refSegments[0];

        if (typeof schemaMap === "object" && refPathSegment in schemaMap) {

           currSchema = schemaMap[refPathSegment];

           // last path in reference
           // found sub-schema
           if (refSegments.length === 1) {
               return currSchema;
           }

           // if current segment points to object && other segments in list
           // recurse into object
           if (refSegments.length > 1 && typeof currSchema === "object") {
               return resolveSchemaPath(currSchema, refSegments.slice(1,refSegments.length));
           }
       }
       return currSchema;
    }

    function itterate(obj, parentKey, parentObj) {

       _.each(obj, function(val, key) {
           var refPath, refSchema, isRelativeRef, paths, refDocumentPath, refSegments;

           if(typeof key === "string") {

                // update path tracking current location 
                // in schema
                if (parentKey === "properties") {
                    currentSchemaPath.push(key);
                }
                if (key === "properties") {
                   currentSchemaPath.push(key);
                }

                // update map of schema `id`s to schema document path
                if (key ==='id' && typeof val === 'string') {
                    schemaIdsMap[val] = currentSchemaPath.join('/');
                }

               if (key.match(/\$ref/)) {

                   // The $ref path value
                   refPath = parentObj[parentKey][key];

                   // check if reference starts with a '#' character
                   // if so, reference is relative (points to subschema with document)
                   isRelativeRef = (refPath.indexOf('#') === 0);

                   // handle relative reference
                   // (e.g.  $ref: `#id` or $ref: `#path/to/property`)
                   if (isRelativeRef) {

                       refDocumentPath = undefined;

                       // strip `#` character and split $ref path
                       // into array of ref path segments
                       refSegments = refPath.substr(1).split('/');

                       // check if $ref with single `segment` is reference to
                       // the `id` of an object previously (!) defined in the schema 
                       // using the current (document) ID map
                       if (refSegments && refSegments.length === 1 && refPath in schemaIdsMap) {
                           refDocumentPath = schemaIdsMap[refPath];

                           refSegments = (refDocumentPath.indexOf('#') === 0 ? refDocumentPath.substr(1).split('/'): undefined);
                       }

                       // try to find document path in the reference
                       if (refSegments && refSegments.length > 1) {

                           refSchema = resolveSchemaPath(contentMap, refSegments.slice(1,refSegments.length));
                           if (refSchema) {
                               return parentObj[parentKey] = refSchema;
                           }
                       }
                   }

                   // $ref is absolute
                   if (!isRelativeRef) {

                       // The $ref keys value should be a path to the sub schema, get it.
                       var filePath = folder + parentObj[parentKey][key];

                       // Check path exists
                       if(fs.existsSync(filePath)) {

                           // Get the subSchema and assume it has an initial key to match the parent
                           // object that is calling it.
                           // TODO: Should the sub schemas follow this pattern or just be keyless objects?
                           // TODO: It should be a keyless object - change this!
                           var subSchema = JSON.parse(fs.readFileSync(filePath, 'binary'))[parentKey];

                           // Return a new itterator into the sub schema and bind that to the parents key
                           return parentObj[parentKey] = itterate(subSchema, parentKey, parentObj);
                       }
                   }
               } // if key --> $ref

               // If a new object is encountered.
               if(typeof val === 'object') {

                   // Itterate down into that
                   itterate(val, key, obj);

               }

               // update objects tracking location
               // in document if processing a `properties`
               // object or its members

               if (key === "properties") {
                   // remove current document path segment
                   // (properties)
                   currentSchemaPath.pop();
               }
               if (parentKey === "properties") {
                   // remove current path segment (key in properties object)
                   currentSchemaPath.pop();
               }
           }
       });

        return obj;

    }

    contents.forEach(function(val, key) {
        // For each schema that is mapped into the contents itterate down into
        // it and look for any $ref keys that will point to sub schemas

        // reset current document path
        currentSchemaPath = new Array('#');

        // reset map of id to document path
        schemaIdsMap = {};

        // schema document map
        contentMap = JSON.parse(val);

        contents[key] = itterate(contentMap);

        // clean up
        schemaIdsMap = undefined;
        currentSchemaPath = undefined;
        contentMap = undefined;
    });

    return contents;

};
