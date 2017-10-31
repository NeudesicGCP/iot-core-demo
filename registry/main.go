// Copyright 2017 Neudesic. All rights reserved.
// Use of this source code is governed by MIT license that can be found in the
// LICENSE file.

// This package implements a REST API that will create an RSA Certificate and
// Key for a device, and register the device with credentials in Cloud IoT Core
// Device Registry.
package main

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"strings"

	"google.golang.org/appengine"
	"google.golang.org/appengine/log"
)

const (
	CONTENT_TYPE_HEADER       = "Content-Type"
	JSON_CONTENT_TYPE         = "application/json"
	CORS_ORIGIN_HEADER        = "Access-Control-Allow-Origin"
	CORS_ORIGIN_HEADER_VALUE  = "*"
	CORS_HEADERS_HEADER       = "Access-Control-Allow-Headers"
	CORS_HEADERS_HEADER_VALUE = "Content-Type,Authorization"
	CORS_METHODS_HEADER       = "Access-Control-Allow-Methods"
	CORS_METHODS_HEADER_VALUE = "POST"
	AUTH_TOKEN_ENV_NAME       = "REGISTRATION_SERVICE_AUTH_TOKEN"
	AUTH_TOKEN_DEFAULT_VALUE  = "awfulsecurity"
	PROJECTID_ENV_NAME        = "REGISTRATION_SERVICE_PROJECTID"
	PROJECTID_DEFAULT_VALUE   = "memes-sandbox"
	LOCATIONID_ENV_NAME       = "REGISTRATION_SERVICE_LOCATIONID"
	LOCATIONID_DEFAULT_VALUE  = "us-central1"
	REGISTRYID_ENV_NAME       = "REGISTRATION_SERVICE_REGISTRYID"
	REGISTRYID_DEFAULT_VALUE  = "memes-registry"
)

var (
	AuthToken  string
	ProjectId  string
	LocationId string
	RegistryId string
)

type PkiRequest struct {
	Name string `json:"name,omitempty"`
}

type PkiResponse struct {
	Name string `json:"name,omitempty"`
	Key  []byte `json:"key,omitempty"`
	Path string `json:"path,omitempty"`
}

func (p PkiResponse) MarshalResponse(w http.ResponseWriter) error {
	w.Header().Set(CONTENT_TYPE_HEADER, JSON_CONTENT_TYPE)
	return json.NewEncoder(w).Encode(p)
}

func (p *PkiRequest) UnmarshalRequest(r *http.Request) error {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, p)
}

func MarshalError(w http.ResponseWriter, error int) {
	w.Header().Set(CONTENT_TYPE_HEADER, JSON_CONTENT_TYPE)
	w.WriteHeader(error)
}

func getEnvOrDefault(name string, def string) string {
	val := os.Getenv(name)
	if val == "" {
		return def
	}
	return val
}

func init() {
	AuthToken = getEnvOrDefault(AUTH_TOKEN_ENV_NAME, AUTH_TOKEN_DEFAULT_VALUE)
	ProjectId = getEnvOrDefault(PROJECTID_ENV_NAME, PROJECTID_DEFAULT_VALUE)
	LocationId = getEnvOrDefault(LOCATIONID_ENV_NAME, LOCATIONID_DEFAULT_VALUE)
	RegistryId = getEnvOrDefault(REGISTRYID_ENV_NAME, REGISTRYID_DEFAULT_VALUE)

	// Add a start-up handler
	http.HandleFunc("/_ah/start", func(w http.ResponseWriter, r *http.Request) {
		ctx := appengine.NewContext(r)
		log.Infof(ctx, "Starting an instance")
	})

	// Add a warm-up handler
	http.HandleFunc("/_ah/warmup", func(w http.ResponseWriter, r *http.Request) {
		ctx := appengine.NewContext(r)
		log.Infof(ctx, "Warming up an instance")
		if !caLoaded {
			loadCA(ctx)
		}
	})

	// Everything else goes to registration end-point
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(CORS_ORIGIN_HEADER, CORS_ORIGIN_HEADER_VALUE)
		switch r.Method {
		case http.MethodPost:
			register(w, r)

		case http.MethodOptions:
			w.Header().Set(CORS_HEADERS_HEADER, CORS_HEADERS_HEADER_VALUE)
			w.Header().Set(CORS_METHODS_HEADER, CORS_METHODS_HEADER_VALUE)
			return

		default:
			log.Errorf(appengine.NewContext(r), "Unsupported HTTP method: %s", r.Method)
			MarshalError(w, http.StatusMethodNotAllowed)
			return
		}
	})
}

// Handle a request, and generate a certification pair
func register(w http.ResponseWriter, r *http.Request) {
	ctx := appengine.NewContext(r)
	var reqAuth string
	if auths, ok := r.Header["Authorization"]; ok && len(auths) >= 1 {
		reqAuth = strings.TrimPrefix(auths[0], "Bearer ")
	}
	if reqAuth == "" {
		log.Infof(ctx, "Authorization token is missing")
		MarshalError(w, http.StatusUnauthorized)
		return
	}
	if reqAuth != AuthToken {
		log.Infof(ctx, "Authorization token is incorrect: %v", reqAuth)
		MarshalError(w, http.StatusUnauthorized)
		return
	}

	pkiRequest := PkiRequest{}
	err := pkiRequest.UnmarshalRequest(r)
	if err != nil {
		log.Warningf(ctx, "Failed to unmarshal request: %v", err)
		MarshalError(w, http.StatusBadRequest)
		return
	}

	if pkiRequest.Name == "" {
		log.Warningf(ctx, "Request is missing device name: %v", pkiRequest)
		MarshalError(w, http.StatusBadRequest)
		return
	}

	cert, key, err := makeCert(ctx, pkiRequest.Name)
	if err != nil {
		log.Warningf(ctx, "Failed to generate a new RSA certificate and key: %v", err)
		MarshalError(w, http.StatusInternalServerError)
		return
	}
	var path string
	path, err = registerDevice(ctx, pkiRequest.Name, cert)
	if err != nil {
		MarshalError(w, http.StatusInternalServerError)
		return
	}

	pkiResponse := PkiResponse{
		Name: pkiRequest.Name,
		Key:  key,
		Path: path,
	}
	log.Debugf(ctx, "New device has been registered")
	err = pkiResponse.MarshalResponse(w)
	if err != nil {
		log.Errorf(ctx, "Failed to marshall response: err = %v, response = %v", err, pkiResponse)
	}
}
